import { useNavigate } from 'react-router-dom'
import { Image as ImageIcon, Plus, Sparkles } from 'lucide-react'
import { Button, DropdownMenu, Icon } from '@astryxdesign/core'
import { useAppStore } from '../../store/app'

export function NewProjectButton({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }): React.JSX.Element {
  const navigate = useNavigate()
  const canUseStudio = useAppStore((state) => state.canUseStudio)
  if (!canUseStudio) {
    return (
      <Button variant="secondary" size={size} label="Reactivate" onClick={() => navigate('/activation')} />
    )
  }
  return (
    <DropdownMenu
      button={{
        label: 'New project',
        variant: 'primary',
        size,
        icon: <Icon icon={Plus} size="sm" />,
        children: 'New'
      }}
      menuWidth={290}
      items={[
        {
          id: 'photo',
          label: 'Image Editor',
          description: 'Change a photo you already have.',
          icon: <Icon icon={ImageIcon} size="sm" />,
          onClick: () => navigate('/library?new=photo')
        },
        {
          id: 'image',
          label: 'Image Generator',
          description: 'Describe a picture and make it.',
          icon: <Icon icon={Sparkles} size="sm" />,
          onClick: () => navigate('/library?new=image')
        }
      ]}
    />
  )
}
