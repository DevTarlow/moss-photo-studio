import { createHashRouter, Navigate } from 'react-router-dom'
import { RootLayout } from './App'
import { Activation } from './screens/Activation'
import { Onboarding } from './screens/Onboarding'
import { Library } from './screens/Library'
import { People } from './screens/People'
import { Products } from './screens/Products'
import { Scenes } from './screens/Scenes'
import { Sets } from './screens/Sets'
import { SetDetail } from './screens/SetDetail'
import { ProductDetail } from './screens/ProductDetail'
import { Usage } from './screens/Usage'
import { Settings } from './screens/Settings'
import { Workspace } from './screens/Workspace'
import { BootRedirect } from './screens/BootRedirect'

const children = [
  { index: true, element: <BootRedirect /> },
  { path: 'activation', element: <Activation /> },
  { path: 'onboarding', element: <Onboarding /> },
  { path: 'library', element: <Library /> },
  { path: 'people', element: <People /> },
  { path: 'products', element: <Products /> },
  { path: 'scenes', element: <Scenes /> },
  { path: 'sets', element: <Sets /> },
  { path: 'sets/:id', element: <SetDetail /> },
  { path: 'product/:id', element: <ProductDetail /> },
  { path: 'usage', element: <Usage /> },
  { path: 'settings', element: <Navigate to="/settings/studio" replace /> },
  { path: 'settings/:section', element: <Settings /> },
  { path: 'project/:id', element: <Workspace /> },
  { path: '*', element: <Navigate to="/products" replace /> }
]

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children
  }
])
