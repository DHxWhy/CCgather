import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-[#18181B] border border-white/10 shadow-2xl',
            headerTitle: 'text-white',
            headerSubtitle: 'text-zinc-400',
            socialButtonsBlockButton:
              'bg-white/5 border-white/10 text-white hover:bg-white/10 transition-colors',
            socialButtonsBlockButtonText: 'text-white font-medium',
            formButtonPrimary:
              'bg-gradient-to-r from-[#FF6B35] to-[#F7931E] hover:opacity-90 transition-opacity',
            footerActionLink: 'text-[#FF6B35] hover:text-[#F7931E]',
            formFieldInput:
              'bg-[#27272A] border-white/10 text-white placeholder:text-zinc-500',
            formFieldLabel: 'text-zinc-400',
          },
        }}
      />
    </div>
  );
}
