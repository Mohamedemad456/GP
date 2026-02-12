import type { Meta, StoryObj } from "@storybook/react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Badge } from "./badge";
import { Button } from "./button";

const meta: Meta<typeof Table> = {
  title: "Design System/Table",
  component: Table,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Sample data table using design tokens.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Alice</TableCell>
          <TableCell>
            <Badge variant="warning">Pending</Badge>
          </TableCell>
          <TableCell>2025-02-01</TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">
              Review
            </Button>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Bob</TableCell>
          <TableCell>
            <Badge variant="success">Approved</Badge>
          </TableCell>
          <TableCell>2025-02-02</TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">
              Review
            </Button>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Carol</TableCell>
          <TableCell>
            <Badge variant="secondary">On hold</Badge>
          </TableCell>
          <TableCell>2025-02-03</TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">
              Review
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const UsersPending: Story = {
  render: () => (
    <Table>
      <TableCaption>Users pending approval (admin).</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">user1@example.com</TableCell>
          <TableCell>John Doe</TableCell>
          <TableCell>
            <Badge variant="warning">Pending</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button size="sm">Approve</Button>
            <Button variant="outline" size="sm" className="ml-2">
              Reject
            </Button>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">user2@example.com</TableCell>
          <TableCell>Jane Smith</TableCell>
          <TableCell>
            <Badge variant="warning">Pending</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button size="sm">Approve</Button>
            <Button variant="outline" size="sm" className="ml-2">
              Reject
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

export const CarsPending: Story = {
  render: () => (
    <Table>
      <TableCaption>Cars posts pending moderation.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">2024 Toyota Camry</TableCell>
          <TableCell>user1@example.com</TableCell>
          <TableCell>
            <Badge variant="warning">Pending</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button size="sm">Approve</Button>
            <Button variant="outline" size="sm" className="ml-2">
              Reject
            </Button>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">2023 Honda Accord</TableCell>
          <TableCell>user2@example.com</TableCell>
          <TableCell>
            <Badge variant="warning">Pending</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button size="sm">Approve</Button>
            <Button variant="outline" size="sm" className="ml-2">
              Reject
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
