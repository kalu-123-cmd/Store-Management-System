import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_ORGANIZATIONS = gql`
  query GetOrganizations {
    organizations {
      id
      name
      code
      type
      status
      createdAt
    }
  }
`;

const GET_DEPARTMENTS = gql`
  query GetDepartments {
    departments {
      id
      name
      code
      organizationId
      status
      createdAt
    }
  }
`;

const GET_WAREHOUSES = gql`
  query GetWarehouses {
    warehouses {
      id
      name
      code
      location
      organizationId
      status
      createdAt
    }
  }
`;

export default function Organizations() {
  const [activeTab, setActiveTab] = useState<'organizations' | 'departments' | 'warehouses'>('organizations');
  const { data: orgData, loading: orgLoading } = useQuery(GET_ORGANIZATIONS);
  const { data: deptData, loading: deptLoading } = useQuery(GET_DEPARTMENTS);
  const { data: whData, loading: whLoading } = useQuery(GET_WAREHOUSES);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Organization Management</h1>
      
      <div className="mb-6 border-b">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-4 py-2 ${activeTab === 'organizations' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}
          >
            Organizations
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 ${activeTab === 'departments' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}
          >
            Departments
          </button>
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`px-4 py-2 ${activeTab === 'warehouses' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}
          >
            Warehouses
          </button>
        </div>
      </div>

      {activeTab === 'organizations' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Organizations</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Add Organization
            </button>
          </div>
          {orgLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orgData?.organizations.map((org: any) => (
                    <tr key={org.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{org.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{org.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{org.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          org.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {org.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'departments' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Departments</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Add Department
            </button>
          </div>
          {deptLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deptData?.departments.map((dept: any) => (
                    <tr key={dept.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{dept.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{dept.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {dept.organizationId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          dept.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {dept.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(dept.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'warehouses' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Warehouses</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Add Warehouse
            </button>
          </div>
          {whLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {whData?.warehouses.map((wh: any) => (
                    <tr key={wh.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{wh.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{wh.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{wh.location}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {wh.organizationId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          wh.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {wh.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(wh.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
