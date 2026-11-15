import { DropdownMenu } from 'radix-ui'
import { PackageCheck } from 'lucide-react'
import type { Product } from '@shared/types'
import { Icon } from '@astryxdesign/core'

export function ProductCard({
  product,
  onOpen,
  onRename,
  onListingKit,
  onDelete
}: {
  product: Product
  onOpen: () => void
  onRename?: () => void
  onListingKit?: () => void
  onDelete?: () => void
}): React.JSX.Element {
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
      <div className="p-3">
        <p className="truncate text-[13px] font-semibold">{product.name}</p>
        <p className="meta mt-0.5">
          {product.source === 'bundled'
            ? product.category
            : `${product.projectCount ?? 0} work · ${product.imageCount ?? 0} ${product.imageCount === 1 ? 'image' : 'images'}`}
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
                {onListingKit && (
                  <DropdownMenu.Item className="menu-item" onSelect={onListingKit}>
                    <Icon icon={PackageCheck} size="sm" /> Listing Kit
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item className="menu-item" data-danger="true" onSelect={onDelete}>Delete</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  )
}
