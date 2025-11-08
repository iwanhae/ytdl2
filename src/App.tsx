import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="flex justify-center gap-8 mb-8">
          <a href="https://vite.dev" target="_blank" rel="noopener noreferrer" 
             className="transition-transform hover:scale-110">
            <img src={viteLogo} className="h-24 w-24 hover:drop-shadow-2xl" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank" rel="noopener noreferrer"
             className="transition-transform hover:scale-110">
            <img src={reactLogo} className="h-24 w-24 hover:drop-shadow-2xl animate-spin-slow" alt="React logo" />
          </a>
        </div>
        
        <h1 className="text-5xl font-bold mb-8 text-gray-800 dark:text-white">
          Vite + React + TypeScript
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-6">
          <button 
            onClick={() => setCount((count) => count + 1)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg 
                     transition-colors duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            count is {count}
          </button>
          <p className="mt-6 text-gray-600 dark:text-gray-300">
            Edit <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm">src/App.tsx</code> and save to test HMR
          </p>
        </div>
        
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Click on the Vite and React logos to learn more
        </p>
        
        <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-300 font-semibold">
            ✓ PWA Ready | ✓ Tailwind CSS | ✓ TypeScript
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
