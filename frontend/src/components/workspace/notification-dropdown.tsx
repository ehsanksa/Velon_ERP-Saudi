import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/locale-context';
import { cn } from '@/lib/utils';

export type NotificationPreview = {
  id: string;
  title: string;
  detail?: string;
  timestamp?: string;
  priority?: string;
};

function priorityClass(priority?: string): string {
  if (priority === 'critical') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (priority === 'high' || priority === 'warning')
    return 'border-warning/40 bg-warning/15 text-warning-foreground';
  return 'border-border bg-muted/50 text-muted-foreground';
}

export function NotificationDropdown({
  items,
  viewAllHref,
  viewAllLabel = 'View All Notifications',
  unreadCount = 0,
  onMarkAllRead,
}: {
  items: NotificationPreview[];
  viewAllHref: string;
  viewAllLabel?: string;
  unreadCount?: number;
  onMarkAllRead?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const showBadge = unreadCount > 0 || items.length > 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <Button
        variant="ghost"
        size="icon"
        className="relative shrink-0 rounded-lg"
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {showBadge ? (
          <span className="bg-foreground absolute top-2 right-2 h-1.5 w-1.5 rounded-full" />
        ) : null}
      </Button>
      {open ? (
        <div
          className={cn(
            'border-border bg-popover text-popover-foreground absolute top-full right-0 z-50 mt-2 w-[min(92vw,360px)] rounded-xl border shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          <div className="border-border flex items-start justify-between gap-2 border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-muted-foreground text-xs">
                {unreadCount > 0 ? `${unreadCount} unread` : 'Recent alerts and updates'}
              </p>
            </div>
            {onMarkAllRead && unreadCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => void onMarkAllRead()}
              >
                {t('Mark all read')}
              </Button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                No recent notifications
              </p>
            ) : (
              <ul className="space-y-1">
                {items.slice(0, 8).map((item) => (
                  <li
                    key={item.id}
                    className="border-border/60 bg-muted/20 hover:bg-muted/40 cursor-pointer rounded-lg border px-3 py-2.5"
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-snug font-medium">{item.title}</p>
                      {item.priority ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] capitalize',
                            priorityClass(item.priority),
                          )}
                        >
                          {item.priority}
                        </span>
                      ) : null}
                    </div>
                    {item.detail ? (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {item.detail}
                      </p>
                    ) : null}
                    {item.timestamp ? (
                      <p className="text-muted-foreground mt-1.5 text-[10px] tracking-wide uppercase">
                        {item.timestamp}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-border border-t p-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full rounded-lg"
              onClick={() => setOpen(false)}
            >
              <Link to={viewAllHref}>{t(viewAllLabel)}</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
