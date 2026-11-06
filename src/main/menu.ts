import { app, BrowserWindow, Menu, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import type { MenuAction, MenuEvent, Project } from '@shared/types'
import { APP_NAME } from '@shared/constants'

export function buildAppMenu(options: {
  getWindow: () => BrowserWindow | null
  recent: Project[]
  dev: boolean
}): void {
  const send = (event: MenuEvent): void => {
    const window = options.getWindow()
    if (window && !window.isDestroyed()) window.webContents.send('moss:menu-action', event)
  }
  const action = (label: string, menuAction: MenuAction, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send({ action: menuAction })
  })
  const theme = (label: string, menuAction: MenuAction): MenuItemConstructorOptions => ({
    label,
    click: () => send({ action: menuAction })
  })
  const recentItems: MenuItemConstructorOptions[] = options.recent.length
    ? options.recent.slice(0, 5).map((project) => ({
        label: project.name,
        click: () => send({ action: 'open-project', projectId: project.id })
      }))
    : [{ label: 'No Recent Projects', enabled: false }]

  const macAppMenu: MenuItemConstructorOptions[] = process.platform === 'darwin'
    ? [{
        label: APP_NAME,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }]
    : []

  const template: MenuItemConstructorOptions[] = [
    ...macAppMenu,
    {
      label: 'File',
      submenu: [
        action('New Set', 'new-set', 'CmdOrCtrl+1'),
        action('New Photo', 'new-photo', 'CmdOrCtrl+2'),
        action('New Image', 'new-image', 'CmdOrCtrl+3'),
        { type: 'separator' },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        action('Export', 'export', 'CmdOrCtrl+E'),
        { role: 'close', label: 'Close Window', accelerator: 'CmdOrCtrl+W' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        action('Undo', 'undo', 'CmdOrCtrl+Z'),
        action('Redo', 'redo', 'Shift+CmdOrCtrl+Z'),
        { type: 'separator' },
        { role: 'cut' },
        action('Copy Image', 'copy-image', 'CmdOrCtrl+Shift+C'),
        action('Paste Image', 'paste-image', 'CmdOrCtrl+V'),
        { type: 'separator' },
        action('Find', 'find', 'CmdOrCtrl+F'),
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        action('Zoom In', 'zoom-in'),
        action('Zoom Out', 'zoom-out'),
        action('Reset Zoom', 'zoom-reset'),
        action('Actual Size', 'actual-size', 'CmdOrCtrl+0'),
        { type: 'separator' },
        action('Toggle Rail', 'toggle-rail', 'CmdOrCtrl+B'),
        action('Toggle Panel', 'toggle-panel', 'CmdOrCtrl+Alt+B'),
        action('Toggle Theme', 'toggle-theme'),
        {
          label: 'Theme',
          submenu: [
            theme('System', 'theme-system'),
            theme('Light', 'theme-light'),
            theme('Dark', 'theme-dark')
          ]
        },
        ...(options.dev
          ? ([{ type: 'separator' }, { role: 'toggleDevTools' }, { role: 'reload' }] as MenuItemConstructorOptions[])
          : [])
      ]
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }]
    },
    {
      role: 'help',
      label: 'Help',
      submenu: [
        action('Guide', 'open-guide', 'F1'),
        action('Keyboard Shortcuts', 'open-shortcuts', 'CmdOrCtrl+/'),
        action('Privacy', 'open-privacy'),
        action('About Moss Photo Studio', 'open-about')
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  if (process.platform !== 'darwin') {
    app.setAboutPanelOptions({
      applicationName: APP_NAME,
      applicationVersion: app.getVersion()
    })
  }
}

export async function openHelpHost(url: string): Promise<void> {
  if (url.startsWith('https://docs.meta.ai/')) await shell.openExternal(url)
}
