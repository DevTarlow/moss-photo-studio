import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Tooltip } from 'radix-ui'
import { router } from './router'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ConfirmProvider } from './components/ui/ConfirmProvider'
import { MossThemeProvider } from './theme/MossThemeProvider'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')
createRoot(root).render(
  <ErrorBoundary>
    <MossThemeProvider>
      <Tooltip.Provider delayDuration={400}>
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </Tooltip.Provider>
    </MossThemeProvider>
  </ErrorBoundary>
)
