import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_PROCUREMENT_REQUESTS = gql`
  query GetProcurementRequests {
    procurementRequests {
      id
      departmentId
      requiredDate
      priority
      justification
      status
      createdAt
      items {
        id
        description
        quantity
        unitOfMeasure
        estimatedUnitCost
      }
    }
  }
`;

const GET_TENDERS = gql`
  query GetTenders {
    tenders {
      id
      projectName
      procurementCategory
      procurementMethod
      submissionDeadline
      status
      createdAt
    }
  }
`;

const GET_CONTRACTS = gql`
  query GetContracts {
    contracts {
      id
      supplierId
      startDate
      endDate
      contractValue
      currency
      status
      createdAt
    }
  }
`;

export default function Procurement() {
  const [activeTab, setActiveTab] = useState<'requests' | 'tenders' | 'contracts'>('requests');
  const { data: requestData, loading: requestLoading } = useQuery(GET_PROCUREMENT_REQUESTS);
  const { data: tenderData, loading: tenderLoading } = useQuery(GET_TENDERS);
  const { data: contractData, loading: contractLoading } = useQuery(GET_CONTRACTS);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Procurement Management</h1>
      
      <div className="mb-6 border-b">
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 ${activeTab === 'requests' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}
          >
            Requests
          </button>
          <button
            onClick={() => setActiveTab('tenders')}
            className={`px-4 py-2 ${activeTab === 'tenders' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}
          >
            Tenders
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-4 py-2 ${activeTab === 'contracts' ? 'border-b-2 border-blue-500 text-blue-600' : ''}`}
          >
            Contracts
          </button>
        </div>
      </div>

      {activeTab === 'requests' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Procurement Requests</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              New Request
            </button>
          </div>
          {requestLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Required Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requestData?.procurementRequests.map((req: any) => (
                    <tr key={req.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {req.items.length} item(s)
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(req.requiredDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          req.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                          req.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          req.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          req.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tenders' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Tenders</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              New Tender
            </button>
          </div>
          {tenderLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenderData?.tenders.map((tender: any) => (
                    <tr key={tender.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{tender.projectName}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{tender.procurementCategory}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{tender.procurementMethod}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(tender.submissionDeadline).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          tender.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                          tender.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {tender.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'contracts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Contracts</h2>
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              New Contract
            </button>
          </div>
          {contractLoading ? (
            <p>Loading...</p>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {contractData?.contracts.map((contract: any) => (
                    <tr key={contract.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{contract.supplierId}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold">
                        ${contract.contractValue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{contract.currency}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(contract.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(contract.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          contract.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          contract.status === 'TERMINATED' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {contract.status}
                        </span>
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
