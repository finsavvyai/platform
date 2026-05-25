import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  CloudUpload,
  Search,
  Add,
  Delete,
  Edit,
  Visibility,
  Download,
  Refresh,
  SmartToy,
  Psychology,
  Description,
  PictureAsPdf,
  Code,
  TableChart,
  Language,
  ExpandMore,
  Close,
  CheckCircle,
  Error,
  Info,
} from '@mui/icons-material';
import { format } from 'date-fns';

// Types
interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'processing' | 'completed' | 'failed';
  uploadedAt: string;
  processedAt?: string;
  tags: string[];
  metadata: any;
  chunkCount?: number;
  embeddingStatus?: 'pending' | 'completed' | 'failed';
}

interface SearchResult {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  metadata: any;
  chunkIndex: number;
}

interface KnowledgeManagementProps {
  apiUrl?: string;
}

const KnowledgeManagement: React.FC<KnowledgeManagementProps> = ({
  apiUrl = 'http://localhost:8000',
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadDialog, setUploadDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedContent, setSelectedContent] = useState('');
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: rowsPerPage.toString(),
        offset: (page * rowsPerPage).toString(),
        ...(filterType !== 'all' && { type: filterType }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });

      const response = await fetch(`${apiUrl}/api/v1/knowledge/documents?${params}`);
      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, page, rowsPerPage, filterType, filterStatus]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle file upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadFiles(event.target.files);
  };

  const handleUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(uploadFiles).forEach((file) => {
        formData.append('files', file);
      });

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          setSuccess('Documents uploaded successfully');
          setUploadDialog(false);
          setUploadFiles(null);
          setUploadProgress(0);
          fetchDocuments();
        } else {
          throw new Error('Upload failed');
        }
        setUploading(false);
      });

      xhr.addEventListener('error', () => {
        setError('Upload failed');
        setUploading(false);
      });

      xhr.open('POST', `${apiUrl}/api/v1/knowledge/documents/upload`);
      xhr.send(formData);

    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload documents');
      setUploading(false);
    }
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/v1/knowledge/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 20,
        }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search documents');
    } finally {
      setSearching(false);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const response = await fetch(`${apiUrl}/api/v1/knowledge/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setSuccess('Document deleted successfully');
      fetchDocuments();
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete document');
    }
  };

  // Handle document view
  const handleViewDocument = async (document: Document) => {
    setSelectedDocument(document);
    setViewDialog(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/knowledge/documents/${document.id}/content`);
      if (!response.ok) throw new Error('Failed to fetch content');

      const data = await response.json();
      setSelectedContent(data.content || '');
    } catch (err) {
      console.error('Failed to fetch content:', err);
      setSelectedContent('Failed to load content');
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'application/pdf':
        return <PictureAsPdf />;
      case 'text/plain':
      case 'text/markdown':
        return <Description />;
      case 'application/json':
      case 'text/csv':
        return <Code />;
      case 'text/html':
        return <Language />;
      default:
        return <Description />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'failed':
        return <Error color="error" />;
      case 'processing':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter((doc) => {
    if (filterType !== 'all' && doc.type !== filterType) return false;
    if (filterStatus !== 'all' && doc.status !== filterStatus) return false;
    return true;
  });

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Knowledge Management
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          indicatorColor="primary"
        >
          <Tab label="Documents" />
          <Tab label="Search" />
          <Tab label="AI Chat" />
        </Tabs>
      </Paper>

      {/* Documents Tab */}
      {activeTab === 0 && (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={() => setUploadDialog(true)}
            >
              Upload Documents
            </Button>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchDocuments}
            >
              Refresh
            </Button>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="application/pdf">PDF</MenuItem>
                <MenuItem value="text/plain">Text</MenuItem>
                <MenuItem value="application/json">JSON</MenuItem>
                <MenuItem value="text/markdown">Markdown</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Uploaded</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getFileIcon(doc.type)}
                        {doc.name}
                      </Box>
                    </TableCell>
                    <TableCell>{doc.type.split('/').pop()}</TableCell>
                    <TableCell>{formatFileSize(doc.size)}</TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getStatusIcon(doc.status)}
                        <Chip
                          label={doc.status}
                          size="small"
                          color={
                            doc.status === 'completed'
                              ? 'success'
                              : doc.status === 'failed'
                              ? 'error'
                              : 'default'
                          }
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      {format(new Date(doc.uploadedAt), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={0.5} flexWrap="wrap">
                        {doc.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" gap={1}>
                        <Tooltip title="View">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDocument(doc)}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDocument(doc.id)}
                            color="error"
                          >
                            <Delete />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={documents.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </TableContainer>
        </Box>
      )}

      {/* Search Tab */}
      {activeTab === 1 && (
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" gap={2} alignItems="center">
              <TextField
                fullWidth
                placeholder="Search your knowledge base..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1 }} />,
                }}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </Box>
          </Paper>

          <Grid container spacing={2}>
            {searchResults.map((result, index) => (
              <Grid item xs={12} key={result.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                      <Typography variant="h6">{result.documentName}</Typography>
                      <Chip
                        label={`Score: ${(result.score * 100).toFixed(1)}%`}
                        size="small"
                        color="primary"
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      Chunk {result.chunkIndex + 1}
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1 }}>
                      {result.content}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {searchResults.length === 0 && searchQuery && !searching && (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="textSecondary">
                No results found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Try adjusting your search query or upload more documents
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* AI Chat Tab */}
      {activeTab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            AI-powered chat interface coming soon! Ask questions about your uploaded documents and get intelligent answers.
          </Alert>
        </Box>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Documents</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.json,.csv,.html,.docx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                fullWidth
                sx={{ py: 2, borderStyle: 'dashed' }}
              >
                <CloudUpload sx={{ mr: 1 }} />
                Select Files
              </Button>
            </label>

            {uploadFiles && uploadFiles.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Selected files:</Typography>
                <List dense>
                  {Array.from(uploadFiles).map((file, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={file.name}
                        secondary={`${formatFileSize(file.size)} • ${file.type}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {uploading && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Uploading... {Math.round(uploadProgress)}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>Cancel</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!uploadFiles || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog
        open={viewDialog}
        onClose={() => setViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedDocument?.name}
          <IconButton
            onClick={() => setViewDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
            <Typography variant="body1" component="pre">
              {selectedContent}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KnowledgeManagement;