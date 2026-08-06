'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

interface Deployment {
  _id: string
  name: string
  image: string
  subdomain: string
  status: string
  port: number
  createdAt: string
}

export default function Dashboard() {
  const router = useRouter()
  const [showDeployForm, setShowDeployForm] = useState(false)
  const [deployData, setDeployData] = useState({
    name: '',
    image: '',
    port: 8080,
  })

  const { data: deployments, mutate } = useSWR<Deployment[]>(
    '/api/deployments',
    async (url: string) => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/')
        return []
      }

      const res = await fetch(`${process.env.API_URL}${url}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/')
        }
        throw new Error('Failed to fetch deployments')
      }

      const data = await res.json()
      return data.deployments || []
    }
  )

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('token')

    try {
      const res = await fetch(`${process.env.API_URL}/api/deployments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(deployData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Deployment failed')
      }

      mutate()
      setShowDeployForm(false)
      setDeployData({ name: '', image: '', port: 8080 })
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Cloudlane</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowDeployForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                New Deployment
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Deployments</h2>

        {showDeployForm && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Deploy Container</h3>
              <form onSubmit={handleDeploy} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    value={deployData.name}
                    onChange={(e) =>
                      setDeployData({ ...deployData, name: e.target.value })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Image
                  </label>
                  <input
                    type="text"
                    required
                    value={deployData.image}
                    onChange={(e) =>
                      setDeployData({ ...deployData, image: e.target.value })
                    }
                    placeholder="myrepo/app:v1"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Port
                  </label>
                  <input
                    type="number"
                    required
                    value={deployData.port}
                    onChange={(e) =>
                      setDeployData({ ...deployData, port: parseInt(e.target.value) })
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDeployForm(false)}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Deploy
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deployments?.map((deployment) => (
            <div
              key={deployment._id}
              className="bg-white rounded-lg shadow p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {deployment.name}
                </h3>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    deployment.status === 'running'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {deployment.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{deployment.image}</p>
              <a
                href={`https://${deployment.subdomain}.cloudlane.run`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                https://{deployment.subdomain}.cloudlane.run
              </a>
              <p className="text-xs text-gray-500 mt-2">
                Created:{' '}
                {new Date(deployment.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}

          {deployments?.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">
                No deployments yet. Click "New Deployment" to get started.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
