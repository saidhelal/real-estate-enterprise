import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { usePortalForgotPassword, usePortalVerifyOtp } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { useLocation, Link } from "wouter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

const requestSchema = z.object({
  identifier: z.string().min(1, "Username or Email is required"),
});

const resetSchema = z.object({
  code: z.string().min(1, "OTP Code is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type RequestFormValues = z.infer<typeof requestSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPassword() {
  const { t, dir } = useLanguage();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [identifier, setIdentifier] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  
  const requestMutation = usePortalForgotPassword();
  const verifyMutation = usePortalVerifyOtp();
  
  const requestForm = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      identifier: "",
    },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      code: "",
      newPassword: "",
    },
  });

  const onRequestSubmit = (values: RequestFormValues) => {
    requestMutation.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          setIdentifier(values.identifier);
          if (res.devCode) {
            setDevCode(res.devCode);
          }
          setStep("reset");
        },
      }
    );
  };

  const onResetSubmit = (values: ResetFormValues) => {
    verifyMutation.mutate(
      { 
        data: {
          identifier,
          code: values.code,
          newPassword: values.newPassword
        } 
      },
      {
        onSuccess: () => {
          setLocation("/login");
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4" dir={dir}>
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="space-y-1 pb-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold shadow-sm">
            P
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {step === "request" ? "Forgot Password" : "Reset Password"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {step === "request" 
              ? "Enter your username or email to receive a reset code." 
              : `Enter the code sent to ${identifier} and your new password.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "request" ? (
            <Form {...requestForm}>
              <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-4">
                <FormField
                  control={requestForm.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Username or Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="john.doe"
                          className="bg-background"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {requestMutation.isError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive mt-4">
                    Failed to request password reset. Please try again.
                  </div>
                )}

                <div className="flex flex-col gap-3 mt-6">
                  <Button
                    type="submit"
                    className="w-full shadow-sm"
                    disabled={requestMutation.isPending}
                  >
                    {requestMutation.isPending ? t("common.loading") : "Send Reset Code"}
                  </Button>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/login">Back to Sign In</Link>
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                
                {devCode && (
                  <Alert className="bg-amber-50 border-amber-200 text-amber-900 mb-4 dark:bg-amber-950/50 dark:border-amber-900 dark:text-amber-200">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Development Mode</AlertTitle>
                    <AlertDescription className="font-mono mt-1 font-bold text-lg">
                      Code: {devCode}
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={resetForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Reset Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456"
                          className="bg-background"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={resetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="bg-background"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {verifyMutation.isError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive mt-4">
                    Invalid code or failed to reset password.
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full mt-6 shadow-sm"
                  disabled={verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? t("common.loading") : "Reset Password"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
