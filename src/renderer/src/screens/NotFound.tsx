import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function NotFound(): React.JSX.Element {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/library', { replace: true })
  }, [navigate])
  return <div />
}
