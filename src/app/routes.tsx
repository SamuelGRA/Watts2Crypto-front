import { createBrowserRouter } from 'react-router-dom'
import { MainLayout } from './components/MainLayout'
import { CalculatorPage } from './pages/CalculatorPage'
import { HardwarePage } from './pages/HardwarePage'
import { SoftwarePage } from './pages/SoftwarePage'
import { ElectricityPage } from './pages/ElectricityPage'
import { CurrenciesPage } from './pages/CurrenciesPage'
import { PoolsPage } from './pages/PoolsPage'
import { GuidePage } from './pages/GuidePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <CalculatorPage /> },
      { path: 'hardware', element: <HardwarePage /> },
      { path: 'software', element: <SoftwarePage /> },
      { path: 'electricity', element: <ElectricityPage /> },
      { path: 'currencies', element: <CurrenciesPage /> },
      { path: 'pools', element: <PoolsPage /> },
      { path: 'guide', element: <GuidePage /> },
    ],
  },
])