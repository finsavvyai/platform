import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Tooltip,
  LinearProgress,
  Tabs,
  Tab,
  Paper,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Add,
  CloudUpload,
  Search,
  Edit,
  Delete,
  Download,
  Visibility,
  MoreVert,
  Description,
  TextSnippet,
  Image,
  PictureAsPdf,
  TableChart,
  Slideshow,
  AudioFile,
  VideoFile,
  Refresh,
  PlayArrow,
  Stop,
  Assessment,
  FilterList,
  Sort,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';

// Import knowledge management components
import KnowledgeManagement from '../KnowledgeManagement/KnowledgeManagement';

// Import API services
import {
  useDocuments,
  useCreateDocument,
  useUpdateDocument,
  useDeleteDocument,
  useUploadDocument,
  useProcessDocument,
  useProcessingStatus,
  useSearchKnowledgeBase,
  formatFileSize,
  getDocumentIcon,
  getEmbeddingStatusColor,
  Document,
  DocumentUpload,
  CreateDocumentRequest,
  SearchRequest,
} from '../../services/knowledgeApi';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`knowledge-tabpanel-${index}`}
      aria-labelledby={`knowledge-tab-${index}`}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const DocumentCard: React.FC<{
  document: Document;
  onEdit: (document: Document) => void;
  onDelete: (documentId: string) => void;
  onView: (document: Document) => void;
  onDownload: (document: Document) => void;
  onProcess: (documentId: string) => void;
}> = ({ document, onEdit, onDelete, onView, onDownload, onProcess }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getIcon = () => {
    const iconName = getDocumentIcon(document.mime_type);
    switch (iconName) {
      case 'text_snippet': return <TextSnippet />;
      case 'image': return <Image />;
      case 'picture_as_pdf': return <PictureAsPdf />;
      case 'table_chart': return <TableChart />;
      case 'slideshow': return <Slideshow />;
      case 'audio_file': return <AudioFile />;
      case 'video_file': return <VideoFile />;
      default: return <Description />;
    }
  };

  const isProcessing = document.embedding_status === 'processing';
  const needsProcessing = document.embedding_status === 'pending' || document.embedding_status === 'failed';

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {getIcon()}
            <Typography variant="h6" component="h2" noWrap sx={{ maxWidth: 200 }}>
              {document.title}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreVert />
          </IconButton>
        </Box>

        <Typography variant="body2" color="text.secondary" paragraph>
          {document.content?.slice(0, 150)}...
        </Typography>

        <Box display="flex" gap={1} mb={2} flexWrap="wrap">
          <Chip
            label={document.embedding_status || 'pending'}
            color={getEmbeddingStatusColor(document.embedding_status) as any}
            size="small"
          />
          {document.chunk_count && (
            <Chip
              label={`${document.chunk_count} chunks`}
              variant="outlined"
              size="small"
              icon={<Assessment />}
            />
          )}
          {document.file_size && (
            <Chip
              label={formatFileSize(document.file_size)}
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {isProcessing && (
          <Box mb={1}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary">
              Processing document...
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary">
          Created: {new Date(document.created_at).toLocaleDateString()}
        </Typography>
      </CardContent>

      <CardActions>
        <Button
          size="small"
          startIcon={<Visibility />}
          onClick={() => onView(document)}
        >
          View
        </Button>
        <Button
          size="small"
          startIcon={<Edit />}
          onClick={() => onEdit(document)}
        >
          Edit
        </Button>
        {needsProcessing && (
          <Button
            size="small"
            startIcon={<PlayArrow />}
            onClick={() => onProcess(document.id)}
            variant="contained"
          >
            Process
          </Button>
        )}
        {document.file_path && (
          <Button
            size="small"
            startIcon={<Download />}
            onClick={() => onDownload(document)}
          >
            Download
          </Button>
        )}
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { onView(document); handleMenuClose(); }}>
          <Visibility sx={{ mr: 1 }} /> View
        </MenuItem>
        <MenuItem onClick={() => { onEdit(document); handleMenuClose(); }}>
          <Edit sx={{ mr: 1 }} /> Edit
        </MenuItem>
        {needsProcessing && (
          <MenuItem onClick={() => { onProcess(document.id); handleMenuClose(); }}>
            <PlayArrow sx={{ mr: 1 }} /> Process
          </MenuItem>
        )}
        {document.file_path && (
          <MenuItem onClick={() => { onDownload(document); handleMenuClose(); }}>
            <Download sx={{ mr: 1 }} /> Download
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => { onDelete(document.id); handleMenuClose(); }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Card>
  );
};

const Documents: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [alert, setAlert] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // API hooks
  const { data: documents = [], isLoading, error } = useDocuments();
  const deleteDocumentMutation = useDeleteDocument();
  const processDocumentMutation = useProcessDocument();
  const searchMutation = useSearchKnowledgeBase();

  // Filter documents based on search and status
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || doc.embedding_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleUploadDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // TODO: Implement file upload
    console.log('File selected:', file.name);
  };

  const handleEditDocument = (document: Document) => {
    setSelectedDocument(document);
    // TODO: Open edit dialog
  };

  const handleDeleteDocument = (documentId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteDocumentMutation.mutate(documentId, {
        onSuccess: () => {
          setAlert({ message: 'Document deleted successfully!', severity: 'success' });
        },
        onError: () => {
          setAlert({ message: 'Failed to delete document', severity: 'error' });
        },
      });
    }
  };

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsViewDialogOpen(true);
  };

  const handleDownloadDocument = async (document: Document) => {
    // TODO: Implement download functionality
    console.log('Downloading document:', document.title);
  };

  const handleProcessDocument = (documentId: string) => {
    processDocumentMutation.mutate(documentId, {
      onSuccess: () => {
        setAlert({ message: 'Document processing started!', severity: 'success' });
      },
      onError: () => {
        setAlert({ message: 'Failed to start document processing', severity: 'error' });
      },
    });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const searchData: SearchRequest = {
        query: searchQuery,
        limit: 20,
      };
      
      const results = await searchMutation.mutateAsync(searchData);
      console.log('Search results:', results);
      // TODO: Display search results
    } catch (error) {
      setAlert({ message: 'Search failed', severity: 'error' });
    }
  };

  const stats = {
    total: documents.length,
    processed: documents.filter(d => d.embedding_status === 'completed').length,
    processing: documents.filter(d => d.embedding_status === 'processing').length,
    pending: documents.filter(d => d.embedding_status === 'pending' || d.embedding_status === 'failed').length,
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load documents. Please try again.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h3" component="h1" gutterBottom>
            Knowledge Base
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and process documents for AI-powered knowledge retrieval
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => {/* TODO: Open create dialog */}}
          >
            Create Document
          </Button>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={handleUploadDocument}
          >
            Upload Document
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={stats.total} color="primary">
                  <Description color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Total Documents</Typography>
                  <Typography variant="body2" color="text.secondary">
                    All documents
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={stats.processed} color="success">
                  <Assessment color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Processed</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ready for search
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={stats.processing} color="warning">
                  <Refresh color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Processing</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Being analyzed
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Badge badgeContent={stats.pending} color="info">
                  <PlayArrow color="action" />
                </Badge>
                <Box ml={2}>
                  <Typography variant="h6">Pending</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Need processing
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Documents" />
          <Tab label="Knowledge Management" />
          <Tab label="Search" />
        </Tabs>
      </Box>

      {/* Documents Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Search and Filter */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="completed">Processed</MenuItem>
                  <MenuItem value="processing">Processing</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Search />}
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Document Grid */}
        <Grid container spacing={3}>
          {filteredDocuments.map((document) => (
            <Grid item xs={12} sm={6} md={4} key={document.id}>
              <DocumentCard
                document={document}
                onEdit={handleEditDocument}
                onDelete={handleDeleteDocument}
                onView={handleViewDocument}
                onDownload={handleDownloadDocument}
                onProcess={handleProcessDocument}
              />
            </Grid>
          ))}
        </Grid>

        {/* Empty State */}
        {filteredDocuments.length === 0 && !isLoading && (
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            sx={{ py: 8 }}
          >
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No documents found
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload or create your first document to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={handleUploadDocument}
            >
              Upload Your First Document
            </Button>
          </Box>
        )}
      </TabPanel>

      {/* Knowledge Management Tab */}
      <TabPanel value={tabValue} index={1}>
        <KnowledgeManagement />
      </TabPanel>

      {/* Search Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>
          Advanced Search
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Search across all processed documents using AI-powered semantic search.
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          Advanced search features will be available once documents are processed.
        </Alert>
      </TabPanel>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf,.doc,.docx,.md,.html,.json,.csv"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Success/Error Alerts */}
      <Snackbar
        open={!!alert}
        autoHideDuration={6000}
        onClose={() => setAlert(null)}
      >
        {alert && (
          <Alert
            onClose={() => setAlert(null)}
            severity={alert.severity}
            sx={{ width: '100%' }}
          >
            {alert.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
};

export default Documents;