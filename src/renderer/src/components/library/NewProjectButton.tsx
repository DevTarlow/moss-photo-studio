import { useNavigate } from 'react-router-dom'
import { Image as ImageIcon, Layers, Plus, Sparkles } from 'lucide-react'
import { DropdownMenu } from '@astryxdesign/core'

export function NewProjectButton({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <DropdownMenu
      button={{
        label: 'New project',
        variant: 'primary',
        size,
        icon: <Plus size={15} />,
        children: 'New'
      }}
      menuWidth={290}
      items={[
        {
          id: 'set',
          label: 'Set',
          description: 'One photo in, a full set out.',
          icon: <Layers size={16} />,
          onClick: () => navigate('/library?new=set')
        },
        {
          id: 'photo',
          label: 'Image Editor',
          description: 'Change a photo you already have.',
          icon: <ImageIcon size={16} />,
          onClick: () => navigate('/library?new=photo')
        },
        {
          id: 'image',
          label: 'Image Generator',
          description: 'Describe a picture and make it.',
          icon: <Sparkles size={16} />,
          onClick: () => navigate('/library?new=image')
        }
      ]}
    />
  )
}
