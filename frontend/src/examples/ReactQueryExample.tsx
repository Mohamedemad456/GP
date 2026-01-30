import { useQuery } from '@tanstack/react-query'

type Todo = {
  id: number
  title: string
  completed: boolean
}

const fetchTodos = async (): Promise<Todo[]> => {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos?_limit=5')
  if (!response.ok) {
    throw new Error('Failed to load todos')
  }
  return response.json()
}

export default function ReactQueryExample() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  })

  if (isLoading) {
    return <p>Loading todos...</p>
  }

  if (isError) {
    return (
      <div>
        <p>Could not load todos: {error.message}</p>
        <button type="button" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <section>
      <h2>React Query Example</h2>
      <ul>
        {data?.map((todo) => (
          <li key={todo.id}>
            {todo.title} {todo.completed ? '✅' : '⬜'}
          </li>
        ))}
      </ul>
    </section>
  )
}
