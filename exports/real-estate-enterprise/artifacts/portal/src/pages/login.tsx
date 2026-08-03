import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { usePortalLogin, getGetPortalMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
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

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { t, dir } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const loginMutation = usePortalLogin();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetPortalMeQueryKey() });
          setLocation("/dashboard");
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
            {t("login.title")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">{t("login.username")}</FormLabel>
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
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-foreground">{t("login.password")}</FormLabel>
                      <Link href="/forgot-password">
                        <span className="text-xs font-medium text-primary hover:underline cursor-pointer">
                          {t("login.forgot")}
                        </span>
                      </Link>
                    </div>
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

              {loginMutation.isError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive mt-4">
                  Invalid username or password
                </div>
              )}

              <Button
                type="submit"
                className="w-full mt-6 shadow-sm"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? t("common.loading") : t("login.submit")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
