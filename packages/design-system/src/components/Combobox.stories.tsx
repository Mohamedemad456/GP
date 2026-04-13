import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Combobox } from "./combobox";
import { Label } from "./label";

// ─── Sample datasets ─────────────────────────────────────────────────────────

const FRUITS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "blueberry", label: "Blueberry" },
  { value: "cherry", label: "Cherry" },
  { value: "grape", label: "Grape" },
  { value: "mango", label: "Mango" },
  { value: "orange", label: "Orange" },
  { value: "peach", label: "Peach" },
  { value: "pear", label: "Pear" },
  { value: "pineapple", label: "Pineapple" },
  { value: "strawberry", label: "Strawberry" },
  { value: "watermelon", label: "Watermelon" },
];

const CAR_MAKES = [
  { value: "bmw", label: "BMW" },
  { value: "chevrolet", label: "Chevrolet" },
  { value: "ford", label: "Ford" },
  { value: "honda", label: "Honda" },
  { value: "hyundai", label: "Hyundai" },
  { value: "kia", label: "Kia" },
  { value: "lexus", label: "Lexus" },
  { value: "mazda", label: "Mazda" },
  { value: "mercedes", label: "Mercedes-Benz" },
  { value: "nissan", label: "Nissan" },
  { value: "subaru", label: "Subaru" },
  { value: "tesla", label: "Tesla" },
  { value: "toyota", label: "Toyota" },
  { value: "volkswagen", label: "Volkswagen" },
  { value: "volvo", label: "Volvo" },
];

const COUNTRIES = Array.from({ length: 30 }, (_, i) => ({
  value: `c${i}`,
  label: [
    "Afghanistan", "Albania", "Algeria", "Argentina", "Australia",
    "Austria", "Bahrain", "Belgium", "Brazil", "Canada",
    "Chile", "China", "Colombia", "Croatia", "Denmark",
    "Egypt", "Finland", "France", "Germany", "Greece",
    "Hungary", "India", "Indonesia", "Iran", "Iraq",
    "Ireland", "Italy", "Japan", "Jordan", "Kuwait",
  ][i],
}));

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof Combobox> = {
  title: "Design System/Combobox",
  component: Combobox,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: "text",
      description: "Currently selected option value",
    },
    placeholder: {
      control: "text",
      description: "Text shown in the trigger when nothing is selected",
    },
    searchPlaceholder: {
      control: "text",
      description: "Placeholder text inside the search input",
    },
    emptyText: {
      control: "text",
      description: "Message shown when no options match the search query",
    },
    disabled: {
      control: "boolean",
      description: "Disables the trigger",
    },
    "aria-invalid": {
      control: "boolean",
      description: "Marks the field as invalid (destructive ring)",
    },
    options: {
      control: false,
      description: "Array of { value, label, disabled? } items",
    },
    onValueChange: {
      action: "onValueChange",
      description: "Called with the selected value when the user picks an option",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Combobox>;

// ─── Stateful wrapper for interactive stories ─────────────────────────────────

function Controlled({
  defaultValue = "",
  ...props
}: Partial<React.ComponentProps<typeof Combobox>> & { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex w-64 flex-col gap-3">
      <Combobox
        {...props}
        options={props.options ?? FRUITS}
        value={value}
        onValueChange={setValue}
      />
      <p className="text-xs text-muted-foreground">
        Selected:{" "}
        <span className="font-mono font-medium text-foreground">
          {value || "—"}
        </span>
      </p>
    </div>
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

/** Basic usage — click the trigger, type to filter, click an option. */
export const Default: Story = {
  render: () => <Controlled />,
};

/** Opens with a pre-selected value. */
export const PreSelected: Story = {
  render: () => (
    <Controlled
      defaultValue="mango"
      placeholder="Select a fruit"
      searchPlaceholder="Filter fruits..."
    />
  ),
};

/** The trigger is disabled; the popover cannot be opened. */
export const Disabled: Story = {
  render: () => (
    <Combobox
      options={FRUITS}
      value="apple"
      placeholder="Select a fruit"
      disabled
      className="w-64"
    />
  ),
};

/** `aria-invalid` gives the trigger the same destructive ring as `Input`. */
export const Invalid: Story = {
  render: () => (
    <Combobox
      options={FRUITS}
      value=""
      placeholder="Select a fruit"
      aria-invalid
      className="w-64"
    />
  ),
};

/** One option is disabled and cannot be selected. */
export const WithDisabledOption: Story = {
  render: () => (
    <Controlled
      options={[
        { value: "apple", label: "Apple" },
        { value: "banana", label: "Banana (unavailable)", disabled: true },
        { value: "cherry", label: "Cherry" },
        { value: "grape", label: "Grape (unavailable)", disabled: true },
        { value: "mango", label: "Mango" },
      ]}
      placeholder="Select a fruit"
    />
  ),
};

/**
 * A large list of options demonstrates how the search input keeps
 * the dropdown manageable even when there are many choices.
 */
export const LargeList: Story = {
  render: () => (
    <Controlled
      options={COUNTRIES}
      placeholder="Select a country"
      searchPlaceholder="Search countries..."
      emptyText="No country matches your search."
    />
  ),
};

/** Real-world example: selecting a car make inside a form. */
export const CarMakes: Story = {
  render: () => {
    function CarMakeForm() {
      const [makeId, setMakeId] = useState("");
      return (
        <div className="flex w-72 flex-col gap-1.5">
          <Label>Car Make <span className="text-destructive">*</span></Label>
          <Combobox
            value={makeId}
            onValueChange={setMakeId}
            options={CAR_MAKES}
            placeholder="Select a make"
            searchPlaceholder="Search makes..."
            emptyText="No make found."
          />
          {!makeId && (
            <p className="text-xs text-muted-foreground">
              Start typing to filter the list.
            </p>
          )}
        </div>
      );
    }
    return <CarMakeForm />;
  },
};

/** Empty initial options list (e.g. while data is loading). */
export const EmptyOptions: Story = {
  render: () => (
    <Combobox
      options={[]}
      value=""
      placeholder="No options available"
      emptyText="No options available right now."
      className="w-64"
    />
  ),
};

/**
 * Shows all variants side by side so you can compare them visually at a glance.
 */
export const AllVariants: Story = {
  parameters: { layout: "padded" },
  render: () => {
    function Row({
      label,
      children,
    }: {
      label: string;
      children: React.ReactNode;
    }) {
      return (
        <div className="flex items-center gap-6">
          <span className="w-36 shrink-0 text-right text-sm text-muted-foreground">
            {label}
          </span>
          {children}
        </div>
      );
    }

    const [value, setValue] = useState("toyota");

    return (
      <div className="flex flex-col gap-4">
        <Row label="Default">
          <Combobox
            options={CAR_MAKES}
            value=""
            placeholder="Select a make"
            className="w-64"
          />
        </Row>
        <Row label="Pre-selected">
          <Combobox
            options={CAR_MAKES}
            value={value}
            onValueChange={setValue}
            placeholder="Select a make"
            className="w-64"
          />
        </Row>
        <Row label="Disabled">
          <Combobox
            options={CAR_MAKES}
            value="honda"
            disabled
            placeholder="Select a make"
            className="w-64"
          />
        </Row>
        <Row label="Invalid">
          <Combobox
            options={CAR_MAKES}
            value=""
            aria-invalid
            placeholder="Select a make"
            className="w-64"
          />
        </Row>
        <Row label="Empty list">
          <Combobox
            options={[]}
            value=""
            placeholder="No options"
            className="w-64"
          />
        </Row>
      </div>
    );
  },
};
