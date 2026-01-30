# Frontend Documentation

## React Query

React Query helps manage server state (data fetched from APIs). It provides
request caching, background refetching, and built-in loading/error states.

### Why we use it
- Avoid manual loading and error state plumbing in each component.
- Get caching and automatic refetching with minimal code.
- Keep data fetching logic consistent and testable.

### How we use it
1. Wrap the app with `QueryClientProvider` once in `src/main.tsx`.
2. Create a query function that returns data (and throws on errors).
3. Use `useQuery` in components to fetch and read data.

Example:
```tsx
import { useQuery } from '@tanstack/react-query'

const fetchTodos = async () => {
  const res = await fetch('/api/todos')
  if (!res.ok) throw new Error('Failed to load')
  return res.json()
}

export function Todos() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  })

  if (isLoading) return <p>Loading...</p>
  if (isError) return <p>Something went wrong</p>

  return <pre>{JSON.stringify(data, null, 2)}</pre>
}
```
