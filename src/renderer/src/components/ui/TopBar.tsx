import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Keyboard, Search } from 'lucide-react'
import { Button, Icon, IconButton, Kbd, TopNav, TopNavHeading } from '@astryxdesign/core'
import { markUrl } from '../../lib/assets'
import { useUiStore } from '../../store/ui'
import { NewProjectButton } from '../library/NewProjectButton'

export function TopBar({
  title,
  titleContent,
  backTo,
  right
}: {
  title?: string
  titleContent?: ReactNode
  backTo?: string
  right?: ReactNode
}): React.JSX.Element {
  const navigate = useNavigate()
  const setPalette = useUiStore((state) => state.setPalette)
  const setShortcuts = useUiStore((state) => state.setShortcuts)

  return (
    <div className="app-topnav-wrap drag-region">
      <TopNav
        label="Studio"
        heading={
          <TopNavHeading
            logo={<img src={markUrl()} alt="" width={24} height={24} className="h-6 w-6 object-contain" />}
            heading="Moss Photo Studio"
            headingHref="/library"
          />
        }
        startContent={
          <div className="no-drag flex min-w-0 items-center gap-2">
            {backTo && (
              <IconButton
                label="Back"
                icon={<Icon icon={ArrowLeft} size="sm" />}
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo)}
              />
            )}
            {titleContent ? (
              <div className="min-w-0">{titleContent}</div>
            ) : title ? (
              <span className="truncate font-semibold">{title}</span>
            ) : null}
          </div>
        }
        endContent={
          <div className="no-drag flex items-center gap-1">
            {right}
            <NewProjectButton />
            <Button
              label="Search"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Search} size="sm" />}
              endContent={<Kbd keys="mod+k" />}
              onClick={() => setPalette(true)}
            />
            <IconButton
              label="Keyboard shortcuts"
              icon={<Icon icon={Keyboard} size="md" />}
              variant="ghost"
              onClick={() => setShortcuts(true)}
            />
          </div>
        }
      />
    </div>
  )
}
