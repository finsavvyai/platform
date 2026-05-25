import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Upload as UploadIcon,
  Folder as FolderIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  CloudUpload as CloudUploadIcon,
  Article as ArticleIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: 'processed' | 'processing' | 'error';
  chunks?: number;
}

interface KnowledgeManagementProps {
  onDocumentSelect?: (doc: Document) => void;
}

const KnowledgeManagement: React.FC<KnowledgeManagementProps> = ({ onDocumentSelect }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      setUploading(true);
      // Simulate upload
      for (const file of acceptedFiles) {
        const newDoc: Document = {
          id: `doc-${Date.now()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          status: 'processing',
        };
        setDocuments((prev) => [...prev, newDoc]);

        // Simulate processing
        setTimeout(() => {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === newDoc.id ? { ...d, status: 'processed', chunks: Math.floor(Math.random() * 50) + 10 } : d
            )
          );
        }, 2000);
      }
      setUploading(false);
      setUploadDialogOpen(false);
    },
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
  });

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <PdfIcon color="error" />;
    if (type.includes('image')) return <ImageIcon color="primary" />;
    if (type.includes('json') || type.includes('code')) return <CodeIcon color="secondary" />;
    return <ArticleIcon color="action" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocs = documents.filter(
    (doc) => doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={600}>
          Knowledge Base
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Upload Documents
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
        <Tab label="All Documents" />
        <Tab label="Recently Added" />
        <Tab label="Processing" />
      </Tabs>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search documents..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700}>
                {documents.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Documents
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700}>
                {documents.filter((d) => d.status === 'processed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Processed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" fontWeight={700}>
                {documents.reduce((sum, d) => sum + (d.chunks || 0), 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Chunks
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Document List */}
      <Paper sx={{ flex: 1, overflow: 'auto' }}>
        {filteredDocs.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              py: 8,
            }}
          >
            <FolderIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No documents yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload documents to build your knowledge base
            </Typography>
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Documents
            </Button>
          </Box>
        ) : (
          <List>
            {filteredDocs.map((doc) => (
              <ListItem
                key={doc.id}
                sx={{ '&:hover': { bgcolor: 'action.hover' }, cursor: 'pointer' }}
                onClick={() => onDocumentSelect?.(doc)}
              >
                <ListItemIcon>{getFileIcon(doc.type)}</ListItemIcon>
                <ListItemText
                  primary={doc.name}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <span>{formatFileSize(doc.size)}</span>
                      <span>•</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      {doc.chunks && (
                        <>
                          <span>•</span>
                          <Chip label={`${doc.chunks} chunks`} size="small" />
                        </>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  {doc.status === 'processing' ? (
                    <Chip label="Processing..." size="small" color="warning" />
                  ) : doc.status === 'error' ? (
                    <Chip label="Error" size="small" color="error" />
                  ) : (
                    <>
                      <IconButton size="small">
                        <ViewIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Documents</DialogTitle>
        <DialogContent>
          <Box
            {...getRootProps()}
            sx={{
              border: 2,
              borderStyle: 'dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: isDragActive ? 'primary.light' : 'grey.50',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'primary.light',
              },
            }}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              or click to select files
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Supported: PDF, TXT, MD, JSON, CSV, DOC, DOCX
            </Typography>
          </Box>

          {uploading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Uploading and processing documents...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KnowledgeManagement;

