/**
 * Example demonstrating the component library usage
 * This file shows how to use and customize components from the library
 */

import { Button } from "@/lib"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/lib"

export const ComponentLibraryExample = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <h1 className="text-4xl mb-8">Component Library Examples</h1>

      {/* Button Variants */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Button Variants</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </section>

      {/* Button Sizes */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Button Sizes</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">🎨</Button>
        </div>
      </section>

      {/* Card Examples */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Card Component</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Card */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Card</CardTitle>
              <CardDescription>
                A simple card with title and description
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>This is the card content area.</p>
            </CardContent>
          </Card>

          {/* Card with Footer */}
          <Card>
            <CardHeader>
              <CardTitle>Card with Footer</CardTitle>
              <CardDescription>
                Card that includes a footer section
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Content goes here</p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button>Save</Button>
            </CardFooter>
          </Card>

          {/* Card with Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>
                Manage your application settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Theme</label>
                <p className="text-sm text-muted-foreground">Choose your theme</p>
              </div>
              <div>
                <label className="text-sm font-medium">Language</label>
                <p className="text-sm text-muted-foreground">Select language</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Apply Changes</Button>
            </CardFooter>
          </Card>

          {/* Custom Styled Card */}
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-primary">Featured Card</CardTitle>
              <CardDescription>
                A card with custom styling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>Customize cards using className prop</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Combined Example */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Combined Example</h2>
        <Card>
          <CardHeader>
            <CardTitle>Product Card</CardTitle>
            <CardDescription>
              Example of combining multiple components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Item Name</span>
              <span className="text-2xl font-bold">$99.99</span>
            </div>
            <p className="text-sm text-muted-foreground">
              This is a product description that explains what the item is.
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1">
              Learn More
            </Button>
            <Button className="flex-1">
              Add to Cart
            </Button>
          </CardFooter>
        </Card>
      </section>

      {/* Customization Example */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Customization Example</h2>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Components can be customized using className:
          </p>
          <Button 
            className="bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            Custom Styled Button
          </Button>
          <Card className="bg-linear-to-br from-blue-50 to-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-900">Custom Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-purple-700">This card has custom background colors</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
