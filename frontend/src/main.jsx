import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import CommandCenter from './paginas/CommandCenter.jsx'
import VisaoExecutiva from './paginas/VisaoExecutiva.jsx'
import AnaliseOperacional from './paginas/AnaliseOperacional.jsx'
import TendenciaPrevisao from './paginas/TendenciaPrevisao.jsx'
import RiscoAlertas from './paginas/RiscoAlertas.jsx'
import './estilo.css'

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <VisaoExecutiva /> },
      { path: 'comando', element: <CommandCenter /> },
      { path: 'operacional', element: <AnaliseOperacional /> },
      { path: 'previsao', element: <TendenciaPrevisao /> },
      { path: 'alertas', element: <RiscoAlertas /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('raiz')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
