//go:build legacy_migrated
// +build legacy_migrated

package anomaly

import (
	"math"
	"sort"
	"time"
)

// IsolationForest implements the Isolation Forest algorithm for anomaly detection
type IsolationForest struct {
	Trees      []*IsolationTree
	MaxDepth   int
	SampleSize int
	NumTrees   int
}

// IsolationTree represents a single tree in the isolation forest
type IsolationTree struct {
	Root    *IsolationNode
	Depth   int
	Left    *IsolationTree
	Right   *IsolationTree
	Split   float64
	Feature int
}

// IsolationNode represents a node in an isolation tree
type IsolationNode struct {
	IsLeaf bool
	Value  float64
	Left   *IsolationNode
	Right  *IsolationNode
	Depth  int
	Size   int
}

// NewIsolationForest creates a new Isolation Forest model
func NewIsolationForest(numTrees, maxDepth, sampleSize int) *IsolationForest {
	return &IsolationForest{
		Trees:      make([]*IsolationTree, 0, numTrees),
		MaxDepth:   maxDepth,
		SampleSize: sampleSize,
		NumTrees:   numTrees,
	}
}

// Fit trains the isolation forest on the given data
func (forest *IsolationForest) Fit(data []DataPoint) error {
	if len(data) < forest.SampleSize {
		forest.SampleSize = len(data)
	}

	values := extractValues(data)

	for i := 0; i < forest.NumTrees; i++ {
		sample := randomSample(values, forest.SampleSize)
		tree := buildIsolationTree(sample, 0, forest.MaxDepth)
		forest.Trees = append(forest.Trees, tree)
	}

	return nil
}

// Predict returns anomaly scores for the given data points
func (forest *IsolationForest) Predict(points []DataPoint) []float64 {
	if len(forest.Trees) == 0 {
		return make([]float64, len(points))
	}

	scores := make([]float64, len(points))
	values := extractValues(points)

	for i, value := range values {
		pathLengths := make([]float64, len(forest.Trees))

		for j, tree := range forest.Trees {
			pathLengths[j] = calculatePathLength(value, tree, 0)
		}

		avgPathLength := average(pathLengths)
		c := averagePathLength(forest.SampleSize)

		if avgPathLength > 0 {
			scores[i] = math.Pow(2, -avgPathLength/c)
		} else {
			scores[i] = 0
		}
	}

	return scores
}

// buildIsolationTree builds a single isolation tree
func buildIsolationTree(sample []float64, currentDepth, maxDepth int) *IsolationTree {
	if len(sample) <= 1 || currentDepth >= maxDepth {
		return &IsolationTree{
			Root: &IsolationNode{
				IsLeaf: true,
				Size:   len(sample),
				Depth:  currentDepth,
			},
			Depth: currentDepth,
		}
	}

	// Select random feature (single dimension for univariate)
	feature := 0

	// Select random split point
	minVal, maxVal := minMax(sample)
	if minVal == maxVal {
		return &IsolationTree{
			Root: &IsolationNode{
				IsLeaf: true,
				Size:   len(sample),
				Depth:  currentDepth,
			},
			Depth: currentDepth,
		}
	}

	split := minVal + (maxVal-minVal)*randFloat()

	// Split data
	leftSample := make([]float64, 0)
	rightSample := make([]float64, 0)

	for _, value := range sample {
		if value < split {
			leftSample = append(leftSample, value)
		} else {
			rightSample = append(rightSample, value)
		}
	}

	leftTree := buildIsolationTree(leftSample, currentDepth+1, maxDepth)
	rightTree := buildIsolationTree(rightSample, currentDepth+1, maxDepth)

	return &IsolationTree{
		Root: &IsolationNode{
			IsLeaf: false,
			Value:  split,
			Left:   leftTree.Root,
			Right:  rightTree.Root,
			Depth:  currentDepth,
			Size:   len(sample),
		},
		Depth:   currentDepth,
		Left:    leftTree,
		Right:   rightTree,
		Split:   split,
		Feature: feature,
	}
}

// calculatePathLength calculates the path length for a value in a tree
func calculatePathLength(value float64, tree *IsolationTree, currentDepth int) float64 {
	if tree.Root.IsLeaf {
		return float64(currentDepth) + averagePathLength(tree.Root.Size)
	}

	if value < tree.Split {
		return calculatePathLength(value, tree.Left, currentDepth+1)
	}
	return calculatePathLength(value, tree.Right, currentDepth+1)
}

// averagePathLength calculates the average path length for unsuccessful searches
func averagePathLength(n int) float64 {
	if n <= 1 {
		return 0
	}

	// Harmonic number H(n-1)
	h := 0.0
	for i := 1; i < n; i++ {
		h += 1.0 / float64(i)
	}

	return 2*h - (2.0 / float64(n))
}

// LSTMModel implements a simple LSTM for time series anomaly detection
type LSTMModel struct {
	InputSize   int
	HiddenSize  int
	OutputSize  int
	Weights     [][][]float64
	Biases      [][]float64
	IsTrained   bool
	SequenceLen int
	Threshold   float64
}

// NewLSTMModel creates a new LSTM model
func NewLSTMModel(inputSize, hiddenSize, outputSize, sequenceLen int) *LSTMModel {
	return &LSTMModel{
		InputSize:   inputSize,
		HiddenSize:  hiddenSize,
		OutputSize:  outputSize,
		SequenceLen: sequenceLen,
		Threshold:   2.0,
		IsTrained:   false,
	}
}

// Fit trains the LSTM model on the given data
func (lstm *LSTMModel) Fit(data []DataPoint) error {
	if len(data) < lstm.SequenceLen {
		return nil
	}

	values := extractValues(data)
	sequences := createSequences(values, lstm.SequenceLen)

	// Simplified training - in a real implementation, this would use backpropagation
	lstm.initializeWeights()

	// Train on sequences
	for _, sequence := range sequences {
		lstm.trainSequence(sequence)
	}

	lstm.IsTrained = true
	return nil
}

// Predict predicts the next value and calculates anomaly score
func (lstm *LSTMModel) Predict(point DataPoint) (float64, error) {
	if !lstm.IsTrained {
		return 0, nil
	}

	// Simplified prediction - in a real implementation, this would use the trained LSTM
	// For now, return a simple distance-based score
	return 0.5, nil
}

// initializeWeights initializes LSTM weights randomly
func (lstm *LSTMModel) initializeWeights() {
	// Simplified weight initialization
	lstm.Weights = make([][][]float64, 2) // Input and recurrent weights
	lstm.Biases = make([][]float64, 2)

	for i := range lstm.Weights {
		lstm.Weights[i] = make([][]float64, lstm.HiddenSize)
		lstm.Biases[i] = make([]float64, lstm.HiddenSize)

		for j := range lstm.Weights[i] {
			lstm.Weights[i][j] = make([]float64, lstm.InputSize)
			for k := range lstm.Weights[i][j] {
				lstm.Weights[i][j][k] = randFloat() - 0.5
			}
			lstm.Biases[i][j] = randFloat() - 0.5
		}
	}
}

// trainSequence trains the LSTM on a single sequence
func (lstm *LSTMModel) trainSequence(sequence []float64) {
	// Simplified training - in a real implementation, this would use backpropagation through time
	// For now, just ensure the model is marked as trained
	lstm.IsTrained = true
}

// AutoencoderModel implements an autoencoder for anomaly detection
type AutoencoderModel struct {
	InputSize    int
	EncodedSize  int
	Weights1     [][]float64
	Weights2     [][]float64
	Bias1        []float64
	Bias2        []float64
	IsTrained    bool
	Threshold    float64
	LearningRate float64
	Epochs       int
}

// NewAutoencoderModel creates a new autoencoder model
func NewAutoencoderModel(inputSize, encodedSize int) *AutoencoderModel {
	return &AutoencoderModel{
		InputSize:    inputSize,
		EncodedSize:  encodedSize,
		Threshold:    0.1,
		LearningRate: 0.01,
		Epochs:       100,
		IsTrained:    false,
	}
}

// Fit trains the autoencoder on the given data
func (ae *AutoencoderModel) Fit(data []DataPoint) error {
	if len(data) < 2 {
		return nil
	}

	values := extractValues(data)

	// Initialize weights
	ae.initializeWeights()

	// Normalize data
	normalized := normalizeData(values)

	// Train autoencoder
	ae.train(normalized)

	// Calculate reconstruction error threshold
	ae.calculateThreshold(normalized)

	ae.IsTrained = true
	return nil
}

// Predict returns reconstruction error for anomaly detection
func (ae *AutoencoderModel) Predict(point DataPoint) (float64, error) {
	if !ae.IsTrained {
		return 0, nil
	}

	// Normalize input
	input := normalizeValue(point.Value, []float64{point.Value})

	// Encode
	encoded := ae.encode(input)

	// Decode
	reconstructed := ae.decode(encoded)

	// Calculate reconstruction error
	error := math.Abs(input - reconstructed)

	return error, nil
}

// initializeWeights initializes autoencoder weights randomly
func (ae *AutoencoderModel) initializeWeights() {
	// Encoder weights (input -> encoded)
	ae.Weights1 = make([][]float64, ae.EncodedSize)
	ae.Bias1 = make([]float64, ae.EncodedSize)

	for i := range ae.Weights1 {
		ae.Weights1[i] = make([]float64, ae.InputSize)
		for j := range ae.Weights1[i] {
			ae.Weights1[i][j] = randFloat() - 0.5
		}
		ae.Bias1[i] = randFloat() - 0.5
	}

	// Decoder weights (encoded -> output)
	ae.Weights2 = make([][]float64, ae.InputSize)
	ae.Bias2 = make([]float64, ae.InputSize)

	for i := range ae.Weights2 {
		ae.Weights2[i] = make([]float64, ae.EncodedSize)
		for j := range ae.Weights2[i] {
			ae.Weights2[i][j] = randFloat() - 0.5
		}
		ae.Bias2[i] = randFloat() - 0.5
	}
}

// train trains the autoencoder using gradient descent
func (ae *AutoencoderModel) train(data []float64) {
	// Simplified training - in a real implementation, this would use proper gradient descent
	for epoch := 0; epoch < ae.Epochs; epoch++ {
		for _, value := range data {
			// Forward pass
			encoded := ae.encode(value)
			reconstructed := ae.decode(encoded)

			// Calculate error
			error := reconstructed - value

			// Backward pass (simplified)
			ae.updateWeights(value, encoded, reconstructed, error)
		}
	}
}

// encode encodes input to lower dimension
func (ae *AutoencoderModel) encode(input float64) []float64 {
	encoded := make([]float64, ae.EncodedSize)

	for i := range encoded {
		// Simple linear transformation
		encoded[i] = ae.Weights1[i][0]*input + ae.Bias1[i]
		// Apply activation function (ReLU)
		if encoded[i] < 0 {
			encoded[i] = 0
		}
	}

	return encoded
}

// decode decodes from lower dimension to original
func (ae *AutoencoderModel) decode(encoded []float64) float64 {
	var output float64

	// Simple linear transformation from encoded to output
	for i, encVal := range encoded {
		output += ae.Weights2[0][i] * encVal
	}
	output += ae.Bias2[0]

	return output
}

// updateWeights updates weights based on error
func (ae *AutoencoderModel) updateWeights(input, encoded, reconstructed, error float64) {
	// Simplified weight update
	learningRate := ae.LearningRate

	// Update decoder weights
	for i := range ae.Weights2[0] {
		ae.Weights2[0][i] -= learningRate * error * encoded[i]
	}
	ae.Bias2[0] -= learningRate * error

	// Update encoder weights (simplified)
	for i := range ae.Weights1 {
		if encoded[i] > 0 { // Only update if activation was not zero
			ae.Weights1[i][0] -= learningRate * error * ae.Weights2[0][i]
			ae.Bias1[i] -= learningRate * error * ae.Weights2[0][i]
		}
	}
}

// calculateThreshold calculates the reconstruction error threshold
func (ae *AutoencoderModel) calculateThreshold(data []float64) {
	errors := make([]float64, len(data))

	for i, value := range data {
		encoded := ae.encode(value)
		reconstructed := ae.decode(encoded)
		errors[i] = math.Abs(value - reconstructed)
	}

	// Set threshold as mean + 2*std of reconstruction errors
	mean := average(errors)
	std := standardDeviation(errors, mean)
	ae.Threshold = mean + 2*std
}

// Utility functions for ML models

func extractValues(data []DataPoint) []float64 {
	values := make([]float64, len(data))
	for i, point := range data {
		values[i] = point.Value
	}
	return values
}

func randomSample(data []float64, size int) []float64 {
	if size >= len(data) {
		return data
	}

	shuffled := make([]float64, len(data))
	copy(shuffled, data)

	// Simple shuffle
	for i := range shuffled {
		j := int(randFloat() * float64(len(shuffled)))
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}

	return shuffled[:size]
}

func minMax(data []float64) (float64, float64) {
	if len(data) == 0 {
		return 0, 0
	}

	min, max := data[0], data[0]
	for _, value := range data[1:] {
		if value < min {
			min = value
		}
		if value > max {
			max = value
		}
	}
	return min, max
}

func randFloat() float64 {
	// Simple random float generator
	return float64(time.Now().UnixNano()%10000) / 10000.0
}

func average(data []float64) float64 {
	if len(data) == 0 {
		return 0
	}

	sum := 0.0
	for _, value := range data {
		sum += value
	}
	return sum / float64(len(data))
}

func standardDeviation(data []float64, mean float64) float64 {
	if len(data) <= 1 {
		return 0
	}

	sum := 0.0
	for _, value := range data {
		diff := value - mean
		sum += diff * diff
	}
	return math.Sqrt(sum / float64(len(data)-1))
}

func createSequences(data []float64, seqLen int) [][]float64 {
	if len(data) < seqLen {
		return [][]float64{data}
	}

	sequences := make([][]float64, 0, len(data)-seqLen+1)
	for i := 0; i <= len(data)-seqLen; i++ {
		sequence := make([]float64, seqLen)
		copy(sequence, data[i:i+seqLen])
		sequences = append(sequences, sequence)
	}

	return sequences
}

func normalizeData(data []float64) []float64 {
	if len(data) == 0 {
		return data
	}

	min, max := minMax(data)
	if max == min {
		return make([]float64, len(data))
	}

	normalized := make([]float64, len(data))
	for i, value := range data {
		normalized[i] = (value - min) / (max - min)
	}

	return normalized
}

func normalizeValue(value float64, data []float64) float64 {
	if len(data) == 0 {
		return value
	}

	min, max := minMax(data)
	if max == min {
		return 0
	}

	return (value - min) / (max - min)
}

// ModelFactory creates different types of ML models
type ModelFactory struct{}

func (mf *ModelFactory) CreateModel(modelType string, params map[string]interface{}) (StatisticalModel, error) {
	switch modelType {
	case "isolation_forest":
		numTrees := getIntParam(params, "num_trees", 100)
		maxDepth := getIntParam(params, "max_depth", 10)
		sampleSize := getIntParam(params, "sample_size", 256)
		return NewIsolationForest(numTrees, maxDepth, sampleSize), nil

	case "lstm":
		inputSize := getIntParam(params, "input_size", 1)
		hiddenSize := getIntParam(params, "hidden_size", 64)
		outputSize := getIntParam(params, "output_size", 1)
		sequenceLen := getIntParam(params, "sequence_len", 10)
		return NewLSTMModel(inputSize, hiddenSize, outputSize, sequenceLen), nil

	case "autoencoder":
		inputSize := getIntParam(params, "input_size", 1)
		encodedSize := getIntParam(params, "encoded_size", 16)
		return NewAutoencoderModel(inputSize, encodedSize), nil

	default:
		return nil, fmt.Errorf("unknown model type: %s", modelType)
	}
}

func getIntParam(params map[string]interface{}, key string, defaultValue int) int {
	if value, ok := params[key].(int); ok {
		return value
	}
	if value, ok := params[key].(float64); ok {
		return int(value)
	}
	return defaultValue
}