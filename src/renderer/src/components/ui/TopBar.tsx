import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Keyboard, Search } from 'lucide-react'
import { Button, Icon, IconButton, Kbd, SideNavCollapseButton, TopNav, TopNavHeading } from '@astryxdesign/core'
import { markUrl } from '../../lib/assets'
import { useViewportTier } from '../../lib/viewport'
import { useUiStore } from '../../store/ui'
import { NewProjectButton } from '../library/NewProjectButton'
import { Tooltip } from './Tooltip'

export function TopBar({
  title,
  titleContent,
  backTo,
  backLabel = 'Back',
  backText,
  railCollapsed = false,
  onToggleRail,
  canToggleRail = false,
  right
}: {
  title?: string
  titleContent?: ReactNode
  backTo?: string
  backLabel?: string
  backText?: string
  railCollapsed?: boolean
  onToggleRail?: () => void
  canToggleRail?: boolean
  right?: ReactNode
}): React.JSX.Element {
  const navigate = useNavigate()
  const tier = useViewportTier()
  const compact = tier === 'tiny'
  const setPalette = useUiStore((state) => state.setPalette)
  const setShortcuts = useUiStore((state) => state.setShortcuts)

  return (
    <div className="app-topnav-wrap drag-region">
      <TopNav
        label="Studio"
        heading={
          <TopNavHeading
            logo={<img src={markUrl()} alt="" width={24} height={24} className="h-6 w-6 object-contain" />}
            logoLabel="Moss Photo Studio"
            heading={compact ? undefined : 'Moss Photo Studio'}
            headingHref="/library"
            headerEndContent={
              canToggleRail && onToggleRail ? (
                <span className="no-drag inline-flex">
                  <Tooltip label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                    <SideNavCollapseButton
                      collapsible={{ isCollapsed: railCollapsed, onCollapsedChange: () => onToggleRail() }}
                      size="sm"
                    />
                  </Tooltip>
                </span>
              ) : undefined
            }
          />
        }
        startContent={
          <div className={`no-drag flex min-w-0 items-center gap-2${compact ? ' max-w-[45vw]' : ''}`}>
            {backTo && (backText ? (
              <Button
                label={backText}
                aria-label={backLabel}
                variant="ghost"
                size="sm"
                icon={<Icon icon={ArrowLeft} size="sm" />}
                onClick={() => navigate(backTo)}
              />
            ) : (
              <IconButton
                label={backLabel}
                icon={<Icon icon={ArrowLeft} size="sm" />}
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo)}
              />
            ))}
            {titleContent ? (
              <div className="min-w-0">{titleContent}</div>
            ) : title ? (
              <span className="max-w-[320px] truncate font-semibold">{title}</span>
            ) : null}
          </div>
        }
        endContent={
          <div className="no-drag flex items-center gap-1">
            {right}
            <NewProjectButton />
            {compact ? (
              <IconButton
                label="Search"
                icon={<Icon icon={Search} size="sm" />}
                variant="ghost"
                size="sm"
                onClick={() => setPalette(true)}
              />
            ) : (
              <Button
                label="Search"
                variant="ghost"
                size="sm"
                icon={<Icon icon={Search} size="sm" />}
                endContent={<Kbd keys="mod+k" />}
                onClick={() => setPalette(true)}
              />
            )}
            {!compact && (
              <IconButton
                label="Keyboard shortcuts"
                icon={<Icon icon={Keyboard} size="md" />}
                variant="ghost"
                onClick={() => setShortcuts(true)}
              />
            )}
          </div>
        }
      />
    </div>
  )
}
