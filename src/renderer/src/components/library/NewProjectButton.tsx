import { useNavigate } from 'react-router-dom'
import { Image as ImageIcon, Layers, Plus, Sparkles } from 'lucide-react'
import { DropdownMenu, Icon } from '@astryxdesign/core'

export function NewProjectButton({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }): React.JSX.Element {
  const navigate = useNavigate()
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
        },
        {
          id: 'pack',
          label: 'Image Pack',
          description: 'A consistent set of shots from one idea.',
          icon: <Icon icon={Layers} size="sm" />,
          onClick: () => navigate('/library?new=pack')
        }
      ]}
    />
  )
}
