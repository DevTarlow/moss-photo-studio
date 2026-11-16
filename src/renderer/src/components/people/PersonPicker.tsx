import { useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown, UserRound, X } from 'lucide-react'
import { Icon } from '@astryxdesign/core'
import type { Person } from '@shared/types'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'

export function PersonPicker({
  people,
  personId,
  personLook = null,
  disabled = false,
  allowRemove = true,
  onPerson
}: {
  people: Person[]
  personId: string | null
  personLook?: string | null
  disabled?: boolean
  allowRemove?: boolean
  onPerson: (id: string | null, look: string | null) => void
}): React.JSX.Element {
  const [previewOpen, setPreviewOpen] = useState(false)
  const selectedPerson = people.find((person) => person.id === personId) ?? null
  const selectedLook = selectedPerson?.looks.find((look) => look.key === personLook) ?? null

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="field field-trigger min-w-0 flex-1"
              aria-label={selectedPerson ? `Person: ${selectedPerson.name}` : 'Choose a Person'}
              disabled={disabled}
            >
              <span className="truncate">
                {selectedPerson
                  ? `${selectedPerson.name}${selectedPerson.ageBand ? ` · ${selectedPerson.ageBand}` : ''}${selectedLook ? ` · ${selectedLook.label}` : ''}`
                  : 'Choose a Person'}
              </span>
              <Icon icon={ChevronDown} size="xsm" className="shrink-0" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="menu-content min-w-[240px]" sideOffset={4}>
              {people.map((person) => (
                <DropdownMenu.Item
                  key={person.id}
                  className="menu-item"
                  onSelect={() => onPerson(person.id, null)}
                >
                  <img src={person.portraitUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                  <span className="min-w-0 flex-1 truncate">{person.name}{person.ageBand ? ` · ${person.ageBand}` : ''}</span>
                  {person.id === selectedPerson?.id && <Icon icon={Check} size="sm" className="ml-auto shrink-0" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        {selectedPerson ? (
          <>
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0 hover:opacity-80"
              aria-label={`See ${selectedPerson.name} larger`}
              disabled={disabled}
              onClick={() => setPreviewOpen(true)}
            >
              <img
                src={selectedLook?.url ?? selectedPerson.portraitUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover"
                onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
              />
            </button>
            {allowRemove && (
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove person"
                disabled={disabled}
                onClick={() => onPerson(null, null)}
              >
                <Icon icon={X} size="sm" />
              </button>
            )}
          </>
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-faint)' }} aria-hidden>
            <Icon icon={UserRound} size="sm" />
          </span>
        )}
      </div>
      {selectedPerson && (
        <Dialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          title={selectedPerson.name}
          description={selectedPerson.ageBand ?? undefined}
          width={460}
          footer={<Button variant="secondary" onClick={() => setPreviewOpen(false)}>Close</Button>}
        >
          <img
            src={selectedLook?.url ?? selectedPerson.portraitUrl}
            alt={`${selectedPerson.name}${selectedLook ? ` ${selectedLook.label}` : ''} portrait`}
            className="mx-auto max-h-[60vh] w-full rounded-[12px] object-contain"
          />
        </Dialog>
      )}
    </>
  )
}
