import { createHashRouter, Navigate } from 'react-router-dom'
import { RootLayout } from './App'
import { Activation } from './screens/Activation'
import { Onboarding } from './screens/Onboarding'
import { Library } from './screens/Library'
import { People } from './screens/People'
import { Products } from './screens/Products'
import { Usage } from './screens/Usage'
import { Settings } from './screens/Settings'
import { Workspace } from './screens/Workspace'
import { BootRedirect } from './screens/BootRedirect'

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <BootRedirect /> },
      { path: 'activation', element: <Activation /> },
      { path: 'onboarding', element: <Onboarding /> },
      { path: 'library', element: <Library /> },
      { path: 'people', element: <People /> },
      { path: 'products', element: <Products /> },
      { path: 'usage', element: <Usage /> },
      { path: 'settings', element: <Navigate to="/settings/studio" replace /> },
      { path: 'settings/:section', element: <Settings /> },
      { path: 'project/:id', element: <Workspace /> },
      { path: '*', element: <Navigate to="/library" replace /> }
    ]
  }
])
