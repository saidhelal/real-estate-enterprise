import { useGetPortalNotifications, useMarkNotificationRead, getGetPortalNotificationsQueryKey } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function Notifications() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useGetPortalNotifications();
  const markRead = useMarkNotificationRead();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.notifications")}</h1>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const handleMarkRead = (id: string) => {
    markRead.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPortalNotificationsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("nav.notifications")}</h1>
      
      {!notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
          <p className="text-lg font-medium text-muted-foreground mb-2">No notifications found</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`overflow-hidden transition-all ${!notification.isRead ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-card'}`}
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${!notification.isRead ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{notification.title}</h3>
                    {notification.body && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(notification.createdAt), "MMM dd, yyyy 'at' hh:mm a")}
                    </p>
                  </div>
                </div>
                
                {!notification.isRead && (
                  <div className="flex justify-end sm:items-center">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleMarkRead(notification.id)}
                      disabled={markRead.isPending}
                      className="shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Read
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
