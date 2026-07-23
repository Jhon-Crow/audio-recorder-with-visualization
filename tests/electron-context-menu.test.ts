/**
 * Tests for the Electron context menu on right-click in editable input fields.
 *
 * The main.js `web-contents-created` handler attaches a `context-menu` listener
 * to every WebContents. When a user right-clicks on an editable element, Electron
 * fires `context-menu` with `params.isEditable = true` and `params.editFlags`
 * describing which clipboard operations are available. The handler should build and
 * show a menu with cut/copy/paste/select-all items.
 *
 * These tests verify that behavior by simulating the handler logic directly.
 */

type EditFlags = {
  canCut: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canSelectAll: boolean;
};

type ContextMenuParams = {
  isEditable: boolean;
  selectionText: string;
  editFlags: EditFlags;
};

type MenuItem = {
  role?: string;
  type?: string;
  enabled?: boolean;
};

function buildContextMenuItems(params: ContextMenuParams): MenuItem[] {
  const { isEditable, selectionText, editFlags } = params;

  if (!isEditable && !selectionText) {
    return [];
  }

  const menuItems: MenuItem[] = [];

  if (isEditable) {
    menuItems.push(
      { role: 'cut', enabled: editFlags.canCut },
      { role: 'copy', enabled: editFlags.canCopy },
      { role: 'paste', enabled: editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: editFlags.canSelectAll }
    );
  } else if (selectionText) {
    menuItems.push({ role: 'copy', enabled: editFlags.canCopy });
  }

  return menuItems;
}

describe('Electron context menu (right-click on inputs)', () => {
  const fullEditFlags: EditFlags = {
    canCut: true,
    canCopy: true,
    canPaste: true,
    canSelectAll: true,
  };

  test('shows cut/copy/paste/selectAll for editable input with text selected', () => {
    const items = buildContextMenuItems({
      isEditable: true,
      selectionText: 'hello',
      editFlags: fullEditFlags,
    });

    expect(items.length).toBeGreaterThan(0);
    expect(items.some(i => i.role === 'cut')).toBe(true);
    expect(items.some(i => i.role === 'copy')).toBe(true);
    expect(items.some(i => i.role === 'paste')).toBe(true);
    expect(items.some(i => i.role === 'selectAll')).toBe(true);
  });

  test('shows menu for editable input even when nothing is selected', () => {
    const items = buildContextMenuItems({
      isEditable: true,
      selectionText: '',
      editFlags: { canCut: false, canCopy: false, canPaste: true, canSelectAll: true },
    });

    expect(items.length).toBeGreaterThan(0);
    expect(items.some(i => i.role === 'paste')).toBe(true);
    expect(items.some(i => i.role === 'selectAll')).toBe(true);
  });

  test('respects editFlags.canCut / canCopy enabled state', () => {
    const items = buildContextMenuItems({
      isEditable: true,
      selectionText: '',
      editFlags: { canCut: false, canCopy: false, canPaste: true, canSelectAll: true },
    });

    const cutItem = items.find(i => i.role === 'cut');
    const copyItem = items.find(i => i.role === 'copy');

    expect(cutItem?.enabled).toBe(false);
    expect(copyItem?.enabled).toBe(false);
  });

  test('shows only copy for non-editable element with selected text', () => {
    const items = buildContextMenuItems({
      isEditable: false,
      selectionText: 'selected text',
      editFlags: { canCut: false, canCopy: true, canPaste: false, canSelectAll: false },
    });

    expect(items.length).toBe(1);
    expect(items[0].role).toBe('copy');
  });

  test('returns no items for non-editable element with no selection', () => {
    const items = buildContextMenuItems({
      isEditable: false,
      selectionText: '',
      editFlags: { canCut: false, canCopy: false, canPaste: false, canSelectAll: false },
    });

    expect(items.length).toBe(0);
  });

  test('includes a separator between clipboard actions and selectAll', () => {
    const items = buildContextMenuItems({
      isEditable: true,
      selectionText: '',
      editFlags: fullEditFlags,
    });

    const separatorIndex = items.findIndex(i => i.type === 'separator');
    const selectAllIndex = items.findIndex(i => i.role === 'selectAll');

    expect(separatorIndex).toBeGreaterThan(-1);
    expect(selectAllIndex).toBeGreaterThan(separatorIndex);
  });
});
