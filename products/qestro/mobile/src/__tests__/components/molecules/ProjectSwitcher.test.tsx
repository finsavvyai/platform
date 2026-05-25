import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProjectSwitcher } from '../../../components/molecules/ProjectSwitcher';

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgSecondary: '#1a1a1a', textPrimary: '#fff', textMuted: '#666',
      accentPrimary: '#3b82f6', borderColor: '#333',
    },
  }),
}));

const mockFetchProjects = jest.fn();
const mockSetActiveProject = jest.fn();

jest.mock('../../../stores/projectStore', () => ({
  useProjectStore: () => ({
    projects: [
      { id: 'p1', name: 'Project Alpha', description: 'Alpha desc' },
      { id: 'p2', name: 'Project Beta', description: '' },
    ],
    activeProject: { id: 'p1', name: 'Project Alpha' },
    fetchProjects: mockFetchProjects,
    setActiveProject: mockSetActiveProject,
  }),
}));

const mockClose = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = jest.requireActual('react-native');
  const MockBottomSheet = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const MockBackdrop = () => null;
  return {
    __esModule: true,
    default: MockBottomSheet,
    BottomSheetBackdrop: MockBackdrop,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

jest.mock('lucide-react-native', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Check: () => <Text>check-icon</Text>,
    Folder: () => <Text>folder-icon</Text>,
  };
});

beforeEach(() => jest.clearAllMocks());

describe('ProjectSwitcher', () => {
  const ref = { current: { close: mockClose, expand: jest.fn(), snapToIndex: jest.fn() } };

  it('renders project list', () => {
    render(<ProjectSwitcher bottomSheetRef={ref as never} />);
    expect(screen.getByText('Switch Project')).toBeTruthy();
    expect(screen.getByText('Project Alpha')).toBeTruthy();
    expect(screen.getByText('Project Beta')).toBeTruthy();
  });

  it('calls fetchProjects on mount', () => {
    render(<ProjectSwitcher bottomSheetRef={ref as never} />);
    expect(mockFetchProjects).toHaveBeenCalled();
  });

  it('shows description for projects that have one', () => {
    render(<ProjectSwitcher bottomSheetRef={ref as never} />);
    expect(screen.getByText('Alpha desc')).toBeTruthy();
  });

  it('calls setActiveProject when a project is pressed', () => {
    render(<ProjectSwitcher bottomSheetRef={ref as never} />);
    fireEvent.press(screen.getByText('Project Beta'));
    expect(mockSetActiveProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p2', name: 'Project Beta' }),
    );
  });
});
