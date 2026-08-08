'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  initiateEmailSignIn,
  initiateEmailSignUp,
  initiatePasswordReset,
} from '@/firebase/non-blocking-login';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters long.' }),
});

type UserFormValue = z.infer<typeof formSchema>;

const getFriendlyAuthError = (errorCode: string): string => {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please sign in.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
             return 'Invalid email or password.';
        default:
            return 'An unexpected error occurred. Please try again.';
    }
};

export function AuthGate() {
  const auth = useAuth();
  const [isPending, setIsPending] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [resetNotice, setResetNotice] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!auth) return;
        const unsub = auth.onAuthStateChanged(
            (user) => {
                // On successful login or state change, clear errors and pending state.
                if (user) {
                    setAuthError(null);
                    setIsPending(false);
                }
            },
            (error) => {
                console.error('Auth state change error:', error);
                setAuthError("An unexpected error occurred. Please try again.");
                setIsPending(false);
            }
        );
        return () => unsub();
    }, [auth]);


  const form = useForm<UserFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleAuthError = (error: any) => {
      const friendlyError = getFriendlyAuthError(error.code);
      setAuthError(friendlyError);
      setResetNotice(null);
      setIsPending(false);
  };

  const onSubmit = (data: UserFormValue, isSignUp: boolean) => {
    setIsPending(true);
    setAuthError(null);
    setResetNotice(null);
    if (isSignUp) {
        initiateEmailSignUp(auth, data.email, data.password, handleAuthError);
    } else {
        initiateEmailSignIn(auth, data.email, data.password, handleAuthError);
    }
  };

  const handlePasswordReset = async () => {
    const email = form.getValues('email');
    // Reset only needs the email, so validate that field on its own rather
    // than making the user satisfy the password rule to recover an account.
    const emailCheck = z.string().email().safeParse(email);
    if (!emailCheck.success) {
      setAuthError('Enter your email address above, then choose "Forgot password".');
      setResetNotice(null);
      return;
    }

    setIsPending(true);
    setAuthError(null);

    let failed = false;
    await initiatePasswordReset(auth, email, (error) => {
      failed = true;
      handleAuthError(error);
    });

    setIsPending(false);
    if (!failed) {
      // Deliberately non-committal: confirming whether an address is
      // registered would leak account existence.
      setResetNotice(`If an account exists for ${email}, a reset link is on its way.`);
    }
  };

  const renderForm = (isSignUp: boolean) => (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => onSubmit(data, isSignUp))}
        className="w-full"
      >
        <Card className="bg-transparent border-0 shadow-none">
          <CardHeader className="text-center">
            <CardTitle className="font-headline text-3xl">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription>
              {isSignUp
                ? 'Forge your own Grimlore to save your campaign ideas.'
                : 'Sign in to access your Grimlore.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="your.name@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <div className="flex flex-col items-stretch p-6 pt-2">
            {authError && (
              <p role="alert" className="text-sm font-medium text-destructive mb-4 text-center">{authError}</p>
            )}
            {resetNotice && (
              <p role="status" className="text-sm font-medium text-primary mb-4 text-center">{resetNotice}</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
            >
              {isPending
                ? isSignUp
                  ? 'Creating Account...'
                  : 'Signing In...'
                : isSignUp
                ? 'Sign Up'
                : 'Sign In'}
            </Button>
            {!isSignUp && (
              <button
                type="button"
                onClick={handlePasswordReset}
                disabled={isPending}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 disabled:opacity-50 transition-colors"
              >
                Forgot password?
              </button>
            )}
          </div>
        </Card>
      </form>
    </Form>
  )

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            {renderForm(false)}
          </TabsContent>
          <TabsContent value="signup">
            {renderForm(true)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
