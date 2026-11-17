import { DropdownMenu } from 'radix-ui'
import { FolderOpen, Image as ImageIcon, Sparkles } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Product } from '@shared/types'
import { IconButton } from '../ui/IconButton'

export function ProductCard({
  product,
  onOpen,
  onRename,
  onDelete,
  onUseInGenerator,
  onTryInEditor,
  onViewProjects
}: {
  product: Product
  onOpen: () => void
  onRename?: () => void
  onDelete?: () => void
  onUseInGenerator?: () => void
  onTryInEditor?: () => void
  onViewProjects?: () => void
}): React.JSX.Element {
  const quickActions =
    product.source === 'bundled' && (onUseInGenerator || onTryInEditor) ? (
      <div className="product-quick-actions">
        {onUseInGenerator && (
          <IconButton label={`Use ${product.name} in the Image Generator`} onClick={onUseInGenerator}>
            <Icon icon={Sparkles} size="sm" />
          </IconButton>
        )}
        {onTryInEditor && (
          <IconButton label={`Try ${product.name} in the Image Editor`} onClick={onTryInEditor}>
            <Icon icon={ImageIcon} size="sm" />
          </IconButton>
        )}
      </div>
    ) : product.source === 'user' && (onUseInGenerator || onTryInEditor || onViewProjects) ? (
      <div className="product-quick-actions">
        {onUseInGenerator && (
          <IconButton label={`Generate a scene with ${product.name}`} onClick={onUseInGenerator}>
            <Icon icon={Sparkles} size="sm" />
          </IconButton>
        )}
        {onTryInEditor && (
          <IconButton label={`Edit ${product.name} in the Image Editor`} onClick={onTryInEditor}>
            <Icon icon={ImageIcon} size="sm" />
          </IconButton>
        )}
        {onViewProjects && (
          <IconButton label={`View projects for ${product.name}`} onClick={onViewProjects}>
            <Icon icon={FolderOpen} size="sm" />
          </IconButton>
        )}
      </div>
    ) : null
  return (
    <div className="card card-hover group relative overflow-hidden">
      <button type="button" className="block w-full cursor-pointer" onClick={onOpen} aria-label={`Open ${product.name}`}>
        <img
          src={product.thumbUrl}
          alt=""
          className={`${product.source === 'bundled' ? 'aspect-square' : 'aspect-[4/3]'} w-full object-cover`}
          style={{ background: 'var(--surface-2)' }}
        />
      </button>
      {quickActions}
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold">{product.name}</p>
        <p className="meta mt-0.5">
          {product.source === 'bundled'
            ? product.category
            : `${product.projectCount ?? 0} ${(product.projectCount ?? 0) === 1 ? 'project' : 'projects'} · ${product.imageCount ?? 0} ${product.imageCount === 1 ? 'image' : 'images'}`}
        </p>
        {product.blurb && <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: 'var(--text-faint)' }}>{product.blurb}</p>}
      </div>
      {product.source === 'user' && onRename && onDelete && (
        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-btn" style={{ background: 'var(--surface)' }} aria-label={`Actions for ${product.name}`}>
                ⋯
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
                <DropdownMenu.Item className="menu-item" onSelect={onRename}>Rename</DropdownMenu.Item>
                <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={onDelete}>Delete</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  )
}
