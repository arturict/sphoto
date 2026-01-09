'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { AlertCircle, ArrowLeft, Cloud, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'localhost'

function CheckoutErrorContent() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const email = searchParams.get('email')

  const getErrorMessage = () => {
    switch (reason) {
      case 'email_exists':
        return {
          title: 'Email Already Registered',
          description: `The email "${email}" is already associated with an existing account.`,
          action: 'login',
        }
      default:
        return {
          title: 'Checkout Error',
          description: 'Something went wrong during checkout. Please try again.',
          action: 'retry',
        }
    }
  }

  const error = getErrorMessage()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl font-semibold">{error.title}</CardTitle>
          <CardDescription className="mt-2">{error.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.action === 'login' && (
            <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
              <p>
                If this is your account, you can log in to your portal to manage your subscription, 
                view billing history, or upgrade/downgrade your plan.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {error.action === 'login' ? (
            <>
              <Button asChild className="w-full">
                <a href={`https://portal.${DOMAIN}`}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Go to Portal
                </a>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild className="w-full">
              <Link href="/#pricing">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Try Again
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default function CheckoutErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Cloud className="h-6 w-6 animate-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    }>
      <CheckoutErrorContent />
    </Suspense>
  )
}
