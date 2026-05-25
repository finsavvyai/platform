import { Alert } from 'react-native';
import { showConfirmDialog } from '../../../components/molecules/ConfirmDialog';

describe('showConfirmDialog', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('calls Alert.alert with title and message', () => {
    showConfirmDialog({
      title: 'Delete?',
      message: 'Are you sure?',
      onConfirm: jest.fn(),
    });
    expect(Alert.alert).toHaveBeenCalledWith('Delete?', 'Are you sure?', expect.any(Array));
  });

  it('uses default labels', () => {
    showConfirmDialog({
      title: 'Test',
      message: 'Msg',
      onConfirm: jest.fn(),
    });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(buttons[0].text).toBe('Cancel');
    expect(buttons[1].text).toBe('Confirm');
  });

  it('uses custom labels', () => {
    showConfirmDialog({
      title: 'Test',
      message: 'Msg',
      confirmLabel: 'Yes',
      cancelLabel: 'No',
      onConfirm: jest.fn(),
    });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(buttons[0].text).toBe('No');
    expect(buttons[1].text).toBe('Yes');
  });

  it('sets destructive style when destructive=true', () => {
    showConfirmDialog({
      title: 'Delete',
      message: 'Sure?',
      destructive: true,
      onConfirm: jest.fn(),
    });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(buttons[1].style).toBe('destructive');
  });

  it('calls onConfirm when confirm pressed', () => {
    const onConfirm = jest.fn();
    showConfirmDialog({ title: 'T', message: 'M', onConfirm });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons[1].onPress();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel pressed', () => {
    const onCancel = jest.fn();
    showConfirmDialog({ title: 'T', message: 'M', onConfirm: jest.fn(), onCancel });
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons[0].onPress();
    expect(onCancel).toHaveBeenCalled();
  });
});
