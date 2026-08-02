import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import MonthlySummary from './pages/MonthlySummary'
import StoreBrowse from './pages/StoreBrowse'
import AddProduct from './pages/frequent-products/AddProduct'
import ProductDetail from './pages/frequent-products/ProductDetail'
import ProductsList from './pages/frequent-products/ProductsList'
import ExpenseCategories from './pages/expenses/ExpenseCategories'
import ExpenseDetail from './pages/expenses/ExpenseDetail'
import ExpensesList from './pages/expenses/ExpensesList'
import MonthDetail from './pages/expenses/MonthDetail'
import OtherMonths from './pages/expenses/OtherMonths'
import ScanTicket from './pages/expenses/ScanTicket'
import UncategorizedItems from './pages/expenses/UncategorizedItems'
import SavingsHub from './pages/savings/SavingsHub'
import AddProject from './pages/projects/AddProject'
import ProjectDetail from './pages/projects/ProjectDetail'
import ProjectsList from './pages/projects/ProjectsList'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/productos-frecuentes" element={<ProductsList />} />
        <Route path="/productos-frecuentes/nuevo" element={<AddProduct />} />
        <Route path="/productos-frecuentes/:id" element={<ProductDetail />} />
        <Route path="/tiendas" element={<StoreBrowse />} />
        <Route path="/gastos" element={<ExpensesList />} />
        <Route path="/gastos/escanear" element={<ScanTicket />} />
        <Route path="/gastos/categorias" element={<ExpenseCategories />} />
        <Route path="/gastos/categorias/otros-meses" element={<OtherMonths />} />
        <Route path="/gastos/categorias/mes/:monthKey" element={<MonthDetail />} />
        <Route path="/gastos/sin-categorizar" element={<UncategorizedItems />} />
        <Route path="/gastos/:id" element={<ExpenseDetail />} />
        <Route path="/ahorro" element={<SavingsHub />} />
        <Route path="/resumen" element={<MonthlySummary />} />
        <Route path="/proyectos" element={<ProjectsList />} />
        <Route path="/proyectos/nuevo" element={<AddProject />} />
        <Route path="/proyectos/:id" element={<ProjectDetail />} />
      </Route>
    </Routes>
  )
}

export default App
