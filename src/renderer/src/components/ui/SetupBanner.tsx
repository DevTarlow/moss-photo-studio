import { useNavigate } from 'react-router-dom'
import { Banner, Button } from '@astryxdesign/core'
import { useAppStore } from '../../store/app'

/** The same resume-setup prompt on every collection surface that can host a new user. */
export function SetupBanner(): React.JSX.Element | null {
  const navigate = useNavigate()
  const settings = useAppStore((state) => state.settings)
  if (!settings || settings.onboardingDone) return null
  return (
    <Banner
      status="info"
      title="Finish setting up"
      description="Add a product photo and make your first image when you're ready."
      endContent={<Button label="Resume Setup" variant="secondary" size="sm" onClick={() => navigate('/onboarding')} />}
      collapsible={false}
    />
  )
}
