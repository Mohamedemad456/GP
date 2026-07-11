import type { Meta, StoryObj } from "@storybook/react";
import { Users, Car, LayoutDashboard } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "./sidebar";

const meta: Meta<typeof Sidebar> = {
  title: "Design System/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <SidebarProvider>
        <Story />
      </SidebarProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Sidebar>;

const navItems = [
  { label: "Users pending", icon: Users, href: "#users-pending" },
  { label: "Cars posts pending", icon: Car, href: "#cars-pending" },
];

export const Default: Story = {
  render: () => (
    <>
      <Sidebar>
        <SidebarHeader className="border-sidebar-border border-b">
          <div className="flex items-center gap-2 px-2 py-2 font-semibold text-sidebar-foreground">
            <LayoutDashboard className="size-5" />
            <span>Admin</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Moderation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild>
                      <a href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t">
          <div className="p-2 text-xs text-sidebar-foreground/70">
            Admin dashboard
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <span className="font-medium text-foreground">Dashboard</span>
        </header>
        <div className="flex-1 p-4">
          <p className="text-muted-foreground">
            Select a section from the sidebar. Users pending and Cars posts
            pending lists will appear here.
          </p>
        </div>
      </SidebarInset>
    </>
  ),
};

export const CollapsibleIcon: Story = {
  render: () => (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-sidebar-border border-b">
          <div className="flex items-center gap-2 px-2 py-2 font-semibold text-sidebar-foreground">
            <LayoutDashboard className="size-5" />
            <span>Admin</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Moderation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <a href={item.href}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
          <span className="font-medium text-foreground">Collapsible (icon)</span>
        </header>
        <div className="flex-1 p-4">
          <p className="text-muted-foreground">
            Sidebar collapses to icons only. Use the trigger or rail to expand.
          </p>
        </div>
      </SidebarInset>
    </>
  ),
};
