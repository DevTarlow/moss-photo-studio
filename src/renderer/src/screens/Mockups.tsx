import { useState } from 'react'
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Layers,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-react'
import {
  Badge,
  Banner,
  Button,
  Card,
  Center,
  ClickableCard,
  FileInput,
  Grid,
  Heading,
  SegmentedControl,
  SegmentedControlItem,
  Stack,
  Step,
  Stepper,
  Text,
  TextInput,
  ToggleButton
} from '@astryxdesign/core'
import { Theme } from '@astryxdesign/core/theme'
import { estimateCents, usd } from '@shared/cost'
import { exampleUrl, markUrl } from '../lib/assets'
import { mossTheme } from '../theme/mossTheme'

type Variant = 'a' | 'b' | 'c'

const STEPS = [
  { label: 'Welcome', optional: false },
  { label: 'Connect Meta', optional: false },
  { label: 'Add a product', optional: false },
  { label: 'Make a set', optional: true },
  { label: 'Ready', optional: false }
] as const

const SHOTS = ['Main shot', 'In use', 'Close-up', 'Size reference', 'Flat lay', 'Gift-ready']

function StepHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }): React.JSX.Element {
  return (
    <Stack gap={2}>
      <Text type="label" color="secondary">
        {eyebrow}
      </Text>
      <Heading level={1}>{title}</Heading>
      <Text type="body" color="secondary">
        {body}
      </Text>
    </Stack>
  )
}

function ToolCard({
  icon,
  title,
  body,
  onClick
}: {
  icon: React.JSX.Element
  title: string
  body: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <ClickableCard label={title} onClick={onClick} padding={4} elevation="low" href={undefined}>
      <Stack gap={2}>
        <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}>
          {icon}
        </span>
        <Text weight="bold">{title}</Text>
        <Text type="supporting" color="secondary">
          {body}
        </Text>
      </Stack>
    </ClickableCard>
  )
}

function WelcomeStep({ onNext }: { onNext: () => void }): React.JSX.Element {
  return (
    <Stack gap={5}>
      <StepHeading
        eyebrow="Welcome"
        title="Your shop's photo studio."
        body="One photo in, a full set out. Change any photo. Make one from words."
      />
      <Grid columns={{ minWidth: 180 }} gap={3}>
        <ToolCard icon={<Layers size={20} />} title="Set Creator" body="One photo in, a full set out." onClick={onNext} />
        <ToolCard icon={<ImageIcon size={20} />} title="Image Editor" body="Change a photo you already have." onClick={onNext} />
        <ToolCard icon={<Sparkles size={20} />} title="Image Generator" body="Describe a picture and make it." onClick={onNext} />
      </Grid>
      <Stack direction="horizontal" gap={2} wrap="wrap">
        <Button label="Set up my studio" variant="primary" onClick={onNext} />
        <Button label="Look around first" variant="ghost" />
      </Stack>
      <Text type="supporting" color="secondary">
        Everything stays on this computer. Your Meta key is the only connection.
      </Text>
    </Stack>
  )
}

function KeyStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }): React.JSX.Element {
  const [key, setKey] = useState('')
  return (
    <Stack gap={5}>
      <StepHeading
        eyebrow="Step 2 of 4"
        title="Connect Meta Muse"
        body="Moss uses your own Meta key to make images. Meta charges your account one cent for each image that comes back."
      />
      <Banner
        status="info"
        title="What you need"
        description="A Meta account, a payment method, and about two minutes. The key is stored on this computer."
        collapsible={false}
      />
      <TextInput
        label="Muse key"
        type="password"
        value={key}
        onChange={setKey}
        placeholder="LLM|..."
        description="The key is stored in your system keyring and never leaves this computer."
        width="100%"
      />
      <Stack direction="horizontal" gap={2} wrap="wrap">
        <Button label="Test and connect" variant="primary" onClick={onNext} />
        <Button label="Add key later" variant="ghost" onClick={onNext} />
        <Button label="Where do I get a key?" variant="secondary" />
      </Stack>
      <Stack direction="horizontal" gap={2} align="center">
        <Button label="Back" variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack} />
        <Text type="supporting" color="secondary">
          A key is required to make images. You can add it later.
        </Text>
      </Stack>
    </Stack>
  )
}

function ProductStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }): React.JSX.Element {
  const [hasProduct, setHasProduct] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  return (
    <Stack gap={5}>
      <StepHeading
        eyebrow="Step 3 of 4"
        title="Add your first product"
        body="One photo. It becomes a Product you can reuse in a set, the editor, or the generator."
      />
      {hasProduct ? (
        <Card padding={4}>
          <Stack direction="horizontal" gap={4} align="start" wrap="wrap">
            <img
              src={exampleUrl('product')}
              alt="The product photo"
              className="h-36 w-44 rounded-lg object-cover"
              style={{ background: 'var(--color-background-muted)' }}
            />
            <Stack gap={2} className="min-w-[180px] flex-1">
              <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
                <Text weight="bold">Ceramic mug</Text>
                <Badge label="Saved as a Product" variant="success" />
              </Stack>
              <Text type="supporting" color="secondary">
                1024 × 1024 · Rename it later on Products.
              </Text>
              <Stack direction="horizontal" gap={2} wrap="wrap">
                <Button label="Continue" variant="primary" onClick={onNext} />
                <Button label="Choose another photo" variant="ghost" onClick={() => setHasProduct(false)} />
              </Stack>
            </Stack>
          </Stack>
        </Card>
      ) : (
        <Stack gap={3}>
          <FileInput
            label="Product photo"
            mode="dropzone"
            value={file}
            onChange={(next) => {
              const picked = Array.isArray(next) ? next[0] ?? null : next
              setFile(picked)
              if (picked) setHasProduct(true)
            }}
            accept="image/jpeg,image/png,image/webp"
            maxSize={40 * 1024 * 1024}
            description="JPEG, PNG, or WebP. Up to 40 MB."
            placeholder="Drop a product photo, or choose a file"
            width="100%"
          />
          <Stack direction="horizontal" gap={2} wrap="wrap">
            <Button label="Continue" variant="primary" onClick={onNext} />
            <Button label="Use a sample photo" variant="secondary" onClick={() => setHasProduct(true)} />
          </Stack>
        </Stack>
      )}
      <Button label="Back" variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack} />
    </Stack>
  )
}

function SetStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }): React.JSX.Element {
  const [count, setCount] = useState('6')
  const [enabled, setEnabled] = useState<string[]>(SHOTS)
  const price = `$${(Number(count) * 0.01).toFixed(2)}`
  return (
    <Stack gap={5}>
      <StepHeading
        eyebrow="Step 4 of 4 · optional"
        title="Make your first set"
        body="Your product is saved. Choose the images to make now, or keep the photo as a Product and make the set later."
      />
      <Card padding={4}>
        <Stack direction="horizontal" gap={3} align="center" wrap="wrap">
          <img src={exampleUrl('product')} alt="" className="h-14 w-14 rounded-md object-cover" />
          <Stack gap={0.5} className="flex-1">
            <Text weight="bold">Ceramic mug</Text>
            <Text type="supporting" color="secondary">
              Saved as a Product
            </Text>
          </Stack>
          <Badge label={`${enabled.length} of 6 shots`} variant="neutral" />
        </Stack>
      </Card>
      <Stack gap={2}>
        <Text weight="bold">How many images?</Text>
        <SegmentedControl value={count} onChange={setCount} label="How many images">
          <SegmentedControlItem value="1" label="1" />
          <SegmentedControlItem value="3" label="3" />
          <SegmentedControlItem value="6" label="6" />
        </SegmentedControl>
      </Stack>
      <Stack gap={2}>
        <Text weight="bold">Choose the shots</Text>
        <Stack direction="horizontal" gap={1.5} wrap="wrap">
          {SHOTS.map((shot) => (
            <ToggleButton
              key={shot}
              label={shot}
              value={shot}
              size="sm"
              isPressed={enabled.includes(shot)}
              onPressedChange={(pressed) => {
                setEnabled((current) => (pressed ? [...current, shot] : current.filter((entry) => entry !== shot)))
              }}
            />
          ))}
        </Stack>
      </Stack>
      <Card variant="muted" padding={3}>
        <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
          <Text weight="bold">
            {count} {Number(count) === 1 ? 'image' : 'images'} · Meta charges {price}
          </Text>
          <Badge label="Price on the button" variant="neutral" />
        </Stack>
      </Card>
      <Stack direction="horizontal" gap={2} wrap="wrap">
        <Button label={`Make ${count} ${Number(count) === 1 ? 'Image' : 'Images'} · ${price}`} variant="primary" onClick={onNext} />
        <Button label="Save product only" variant="secondary" onClick={onNext} />
        <Button label="Back" variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack} />
      </Stack>
    </Stack>
  )
}

function ReadyStep({ onRestart }: { onRestart: () => void }): React.JSX.Element {
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Badge label="Setup complete" variant="success" />
        <Heading level={1}>You're set up.</Heading>
        <Text type="body" color="secondary">
          Your product is saved and your studio is ready. Pick a tool to start.
        </Text>
      </Stack>
      <Card padding={4}>
        <Stack direction="horizontal" gap={4} align="center" wrap="wrap">
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)' }}>
            <Check size={20} />
          </span>
          <Stack gap={0.5} className="flex-1">
            <Text weight="bold">Meta connected · Product saved · 6 images made</Text>
            <Text type="supporting" color="secondary">
              Ceramic mug · {usd(estimateCents(6))} spent on this set
            </Text>
          </Stack>
          <Badge label="Ready" variant="success" />
        </Stack>
      </Card>
      <Grid columns={{ minWidth: 180 }} gap={3}>
        <ToolCard icon={<Layers size={20} />} title="Set Creator" body="Open your set or start another." onClick={onRestart} />
        <ToolCard icon={<ImageIcon size={20} />} title="Image Editor" body="Change a photo you already have." onClick={onRestart} />
        <ToolCard icon={<Sparkles size={20} />} title="Image Generator" body="Describe a picture and make it." onClick={onRestart} />
      </Grid>
      <Stack direction="horizontal" gap={2} wrap="wrap">
        <Button label="Open Library" variant="primary" />
        <Button label="Open Products" variant="secondary" />
        <Button label="Personalize in Settings" variant="ghost" />
      </Stack>
    </Stack>
  )
}

function StepContent({ step, onNext, onBack, onRestart }: { step: number; onNext: () => void; onBack: () => void; onRestart: () => void }): React.JSX.Element {
  switch (step) {
    case 0:
      return <WelcomeStep onNext={onNext} />
    case 1:
      return <KeyStep onNext={onNext} onBack={onBack} />
    case 2:
      return <ProductStep onNext={onNext} onBack={onBack} />
    case 3:
      return <SetStep onNext={onNext} onBack={onBack} />
    default:
      return <ReadyStep onRestart={onRestart} />
  }
}

function Rail({ step, onStep }: { step: number; onStep: (next: number) => void }): React.JSX.Element {
  return (
    <Card padding={4} className="h-fit">
      <Stack gap={4}>
        <Text type="label" color="secondary">
          Your setup
        </Text>
        <Stepper activeStep={step} orientation="vertical" label="Setup steps" onStepClick={onStep}>
          {STEPS.map((entry, index) => (
            <Step key={entry.label} step={index} label={entry.label} isOptional={entry.optional} />
          ))}
        </Stepper>
        <Stack gap={1}>
          <Text type="supporting" color="secondary">
            Optional
          </Text>
          <Text type="body" color="secondary">
            Logo and colors live in Settings whenever you want them.
          </Text>
        </Stack>
      </Stack>
    </Card>
  )
}

function GuidedRail({ step, setStep }: { step: number; setStep: (next: number) => void }): React.JSX.Element {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="hidden lg:block">
        <Rail step={step} onStep={setStep} />
      </div>
      <Card padding={6} elevation="low">
        <Stack gap={5}>
          <div className="lg:hidden">
            <Stepper
              activeStep={step}
              label="Setup steps"
              onStepClick={setStep}
              horizontalOptions={{ minimumStepWidth: 112, collapsedVariant: 'withLabel' }}
            >
              {STEPS.map((entry, index) => (
                <Step key={entry.label} step={index} label={entry.label} isOptional={entry.optional} />
              ))}
            </Stepper>
          </div>
          <StepContent
            step={step}
            onNext={() => setStep(Math.min(STEPS.length - 1, step + 1))}
            onBack={() => setStep(Math.max(0, step - 1))}
            onRestart={() => setStep(0)}
          />
        </Stack>
      </Card>
    </div>
  )
}

function FocusMode({ step, setStep }: { step: number; setStep: (next: number) => void }): React.JSX.Element {
  return (
    <Center>
      <Stack gap={5} width="100%" maxWidth={680}>
        <Stepper
          activeStep={step}
          label="Setup steps"
          onStepClick={setStep}
          horizontalOptions={{ minimumStepWidth: 120, collapsedVariant: 'withLabel' }}
        >
          {STEPS.map((entry, index) => (
            <Step key={entry.label} step={index} label={entry.label} isOptional={entry.optional} />
          ))}
        </Stepper>
        <Card padding={6} elevation="low">
          <Stack gap={5}>
            <StepContent
              step={step}
              onNext={() => setStep(Math.min(STEPS.length - 1, step + 1))}
              onBack={() => setStep(Math.max(0, step - 1))}
              onRestart={() => setStep(0)}
            />
          </Stack>
        </Card>
      </Stack>
    </Center>
  )
}

function SetupBoard({ step, setStep }: { step: number; setStep: (next: number) => void }): React.JSX.Element {
  return (
    <Stack gap={5}>
      <Stack gap={2}>
        <Stack direction="horizontal" gap={2}>
          <Badge label="Setup board" variant="neutral" />
        </Stack>
        <Heading level={1}>Let's get your studio ready.</Heading>
        <Text type="body" color="secondary">
          Set up the essentials, or jump straight into a tool. You can come back to any step.
        </Text>
      </Stack>
      <div className="grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <Card padding={4}>
          <Stack gap={4}>
            <Text type="label" color="secondary">
              Get set up
            </Text>
            <Stepper activeStep={step} orientation="vertical" label="Setup steps" onStepClick={setStep}>
              {STEPS.map((entry, index) => (
                <Step key={entry.label} step={index} label={entry.label} isOptional={entry.optional} />
              ))}
            </Stepper>
            <Stack direction="horizontal" gap={2}>
              <Button label="Continue setup" variant="primary" onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} />
            </Stack>
          </Stack>
        </Card>
        <Card padding={4}>
          <Stack gap={4}>
            <Text type="label" color="secondary">
              What do you want to do?
            </Text>
            <Grid columns={{ minWidth: 180 }} gap={3}>
              <ToolCard icon={<Layers size={20} />} title="Set Creator" body="One photo in, a full set out." onClick={() => setStep(2)} />
              <ToolCard icon={<ImageIcon size={20} />} title="Image Editor" body="Change a photo you already have." onClick={() => setStep(2)} />
              <ToolCard icon={<Sparkles size={20} />} title="Image Generator" body="Describe a picture and make it." onClick={() => setStep(2)} />
            </Grid>
          </Stack>
        </Card>
      </div>
      <Card padding={4}>
        <Stack direction="horizontal" gap={3} align="center" wrap="wrap">
          <img src={exampleUrl('product')} alt="" className="h-12 w-12 rounded-md object-cover" />
          <Stack gap={0.5} className="flex-1">
            <Text weight="bold">Your product: Ceramic mug</Text>
            <Text type="supporting" color="secondary">
              Saved as a Product · make a set whenever you're ready
            </Text>
          </Stack>
          <Button label="Open Products" variant="secondary" />
        </Stack>
      </Card>
      {step === 0 ? (
        <Card variant="muted" padding={4}>
          <Text type="body" color="secondary">
            Pick a setup step on the left, or choose a tool to start. The checklist and the tool board stay visible together.
          </Text>
        </Card>
      ) : (
        <Card padding={6} elevation="low">
          <StepContent
            step={step}
            onNext={() => setStep(Math.min(STEPS.length - 1, step + 1))}
            onBack={() => setStep(Math.max(0, step - 1))}
            onRestart={() => setStep(0)}
          />
        </Card>
      )}
    </Stack>
  )
}

export function Mockups(): React.JSX.Element {
  const [variant, setVariant] = useState<Variant>('a')
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  const shell = variant === 'a' ? <GuidedRail step={step} setStep={setStep} /> : variant === 'b' ? <FocusMode step={step} setStep={setStep} /> : <SetupBoard step={step} setStep={setStep} />

  return (
    <Theme theme={mossTheme} mode={mode}>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--color-background-body)', color: 'var(--color-text-primary)' }}>
        <div className="sticky top-0 z-10 border-b px-5 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-background-surface)' }}>
          <Stack direction="horizontal" gap={3} align="center" wrap="wrap">
            <Stack direction="horizontal" gap={2} align="center">
              <img src={markUrl()} alt="" className="h-7 w-7 object-contain" />
              <Text weight="bold">Moss · Astryx mockups</Text>
              <Badge label="Dev only" variant="warning" />
            </Stack>
            <Stack direction="horizontal" gap={1.5} align="center" wrap="wrap" className="ml-auto">
              <Button label="A · Guided rail" variant={variant === 'a' ? 'primary' : 'secondary'} size="sm" onClick={() => setVariant('a')} />
              <Button label="B · Focus mode" variant={variant === 'b' ? 'primary' : 'secondary'} size="sm" onClick={() => setVariant('b')} />
              <Button label="C · Setup board" variant={variant === 'c' ? 'primary' : 'secondary'} size="sm" onClick={() => setVariant('c')} />
              <Button
                label={mode === 'light' ? 'Dark preview' : 'Light preview'}
                variant="ghost"
                size="sm"
                icon={mode === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                onClick={() => setMode((current) => (current === 'light' ? 'dark' : 'light'))}
              />
            </Stack>
          </Stack>
        </div>

        <main className="mx-auto w-full max-w-[1180px] px-5 py-6">
          <Stack gap={5}>
            <Card variant="muted" padding={4}>
              <Stack gap={1}>
                <Text weight="bold">Three ways to make onboarding feel guided.</Text>
                <Text type="supporting" color="secondary">
                  These are live Astryx compositions using the Moss theme. They are not wired to the studio yet. Pick a direction after reviewing them at 1440 and 1024.
                </Text>
              </Stack>
            </Card>
            <Stack direction="horizontal" gap={2} align="center" wrap="wrap">
              {STEPS.map((entry, index) => (
                <Button
                  key={entry.label}
                  label={entry.label}
                  variant={step === index ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setStep(index)}
                />
              ))}
              <Text type="supporting" color="secondary">
                Switch steps to see the flow, then choose a shell.
              </Text>
            </Stack>
            {shell}
          </Stack>
        </main>
      </div>
    </Theme>
  )
}
