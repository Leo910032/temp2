'use client';

import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TapitDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Données CA Cartes par type
  const cartesSalesData = [
    { year: 'Année 1', PVC: 14395, Bois: 6398, Métal: 7998, total: 28792 },
    { year: 'Année 2', PVC: 53982, Bois: 23994, Métal: 29994, total: 107970 },
    { year: 'Année 3', PVC: 107964, Bois: 47988, Métal: 59988, total: 215940 }
  ];

  // Données ARR évolution mensuelle
  const arrEvolutionData = [
    { mois: 'M3', arr: 17400, cartesCumul: 7200 },
    { mois: 'M6', arr: 34800, cartesCumul: 14400 },
    { mois: 'M9', arr: 52200, cartesCumul: 21600 },
    { mois: 'M12', arr: 69600, cartesCumul: 28800 },
    { mois: 'M15', arr: 124200, cartesCumul: 45000 },
    { mois: 'M18', arr: 186600, cartesCumul: 63000 },
    { mois: 'M21', arr: 248400, cartesCumul: 81000 },
    { mois: 'M24', arr: 373200, cartesCumul: 108000 },
    { mois: 'M27', arr: 560400, cartesCumul: 144000 },
    { mois: 'M30', arr: 747000, cartesCumul: 180000 },
    { mois: 'M33', arr: 933600, cartesCumul: 198000 },
    { mois: 'M36', arr: 1120800, cartesCumul: 216000 }
  ];

  // Données répartition CA Année 3
  const revenueBreakdownY3 = [
    { name: 'CA SaaS', value: 747000, color: '#10b981' },
    { name: 'CA Cartes', value: 215940, color: '#3b82f6' }
  ];

  // Données P&L
  const plData = [
    {
      year: 'Année 1',
      ca: 63592,
      charges: 16740,
      resultat: 46852,
      marge: 73.7
    },
    {
      year: 'Année 2',
      ca: 329370,
      charges: 82300,
      resultat: 247070,
      marge: 75.0
    },
    {
      year: 'Année 3',
      ca: 962940,
      charges: 504300,
      resultat: 458640,
      marge: 47.6
    }
  ];

  // Données entonnoirs de conversion
  const funnelDataByYear = {
    year1: [
      { stage: 'Ventes de Cartes NFC', value: 800, percent: 100, color: '#3b82f6' },
      { stage: 'Utilisateurs Actifs', value: 600, percent: 75, color: '#8b5cf6' },
      { stage: 'Abonnés SaaS', value: 220, percent: 27.5, color: '#10b981' }
    ],
    year2: [
      { stage: 'Ventes de Cartes NFC', value: 3000, percent: 100, color: '#3b82f6' },
      { stage: 'Utilisateurs Actifs', value: 2850, percent: 95, color: '#8b5cf6' },
      { stage: 'Abonnés SaaS', value: 1140, percent: 38, color: '#10b981' }
    ],
    year3: [
      { stage: 'Ventes de Cartes NFC', value: 6000, percent: 100, color: '#3b82f6' },
      { stage: 'Utilisateurs Actifs', value: 5100, percent: 85, color: '#8b5cf6' },
      { stage: 'Abonnés SaaS', value: 3150, percent: 52.5, color: '#10b981' }
    ]
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toLocaleString('fr-FR')} €
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const FunnelYear = ({ data, year, arr, subscribers, conversionRate }) => (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-bold text-center mb-3 text-gray-800">
        {year}
      </h3>

      <div className="relative mb-3">
        {data.map((stage, index) => {
          const width = stage.percent;
          const height = 65;

          return (
            <div key={index} className="mb-2">
              <div
                className="mx-auto transition-all duration-300 hover:scale-105"
                style={{
                  width: `${width}%`,
                  maxWidth: '100%',
                  height: `${height}px`,
                  backgroundColor: stage.color,
                  clipPath: index < data.length - 1
                    ? 'polygon(0 0, 100% 0, 95% 100%, 5% 100%)'
                    : 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className="text-white text-center font-semibold px-2">
                  <div className="text-xs">{stage.stage}</div>
                  <div className="text-lg font-bold mt-1">
                    {stage.value.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-xs opacity-90">
                    {stage.percent}%
                  </div>
                </div>
              </div>

              {index < data.length - 1 && (
                <div className="flex justify-center my-1">
                  <svg width="20" height="12" className="text-gray-400">
                    <path d="M10 0 L10 12 M6 8 L10 12 L14 8" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t pt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">ARR :</span>
          <span className="font-bold text-green-600">{arr}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Abonnés :</span>
          <span className="font-bold text-purple-600">{subscribers}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Conversion :</span>
          <span className="font-bold text-blue-600">{conversionRate}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Tapit SAS - Projections Financières
          </h1>
          <p className="text-lg text-gray-600">
            Scénario Conservateur | Version Révisée Octobre 2025
          </p>
          <div className="mt-4 inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full">
            <span className="font-semibold">✓ Rentable dès l&apos;Année 1</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-6 bg-white rounded-lg shadow-sm p-1">
          {['overview', 'revenue', 'conversion', 'profitability'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'revenue' && 'Revenus'}
              {tab === 'conversion' && 'Conversion'}
              {tab === 'profitability' && 'Rentabilité'}
            </button>
          ))}
        </div>

        {/* KPIs Summary */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-600 mb-1">CA Total Année 3</div>
                <div className="text-3xl font-bold text-blue-600">€963k</div>
                <div className="text-xs text-green-600 mt-1">+192% vs Année 2</div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-600 mb-1">ARR Année 3</div>
                <div className="text-3xl font-bold text-green-600">€1.12M</div>
                <div className="text-xs text-green-600 mt-1">+200% vs Année 2</div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-600 mb-1">Bénéfice Année 3</div>
                <div className="text-3xl font-bold text-purple-600">€459k</div>
                <div className="text-xs text-purple-600 mt-1">47.6% marge nette</div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-600 mb-1">Abonnés Payants</div>
                <div className="text-3xl font-bold text-indigo-600">3 150</div>
                <div className="text-xs text-indigo-600 mt-1">46% conversion cumulée</div>
              </div>
            </div>

            {/* P&L Chart */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Compte de Résultat sur 3 Ans
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="ca" fill="#3b82f6" name="Chiffre d'Affaires" />
                  <Bar dataKey="charges" fill="#ef4444" name="Charges Totales" />
                  <Bar dataKey="resultat" fill="#10b981" name="Résultat Net" />
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-4 mt-4">
                {plData.map((year) => (
                  <div key={year.year} className="bg-gray-50 rounded p-3 text-center">
                    <div className="text-xs text-gray-600">{year.year}</div>
                    <div className="text-lg font-bold text-green-600">
                      {year.marge.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">Marge nette</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            {/* Cartes Sales */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Évolution des Ventes de Cartes NFC
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={cartesSalesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="PVC" stackId="a" fill="#3b82f6" name="Cartes PVC" />
                  <Bar dataKey="Bois" stackId="a" fill="#f59e0b" name="Cartes Bois" />
                  <Bar dataKey="Métal" stackId="a" fill="#6366f1" name="Cartes Métal" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ARR Evolution */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Croissance de l&apos;ARR sur 36 Mois
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={arrEvolutionData}>
                  <defs>
                    <linearGradient id="colorARR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorCartes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mois" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cartesCumul"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorCartes)"
                    name="CA Cartes (cumulé)"
                  />
                  <Area
                    type="monotone"
                    dataKey="arr"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorARR)"
                    name="ARR"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Mix Y3 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Répartition du CA - Année 3
              </h2>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueBreakdownY3}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueBreakdownY3.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString('fr-FR')} €`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Le SaaS représente <strong className="text-green-600">77.6%</strong> du CA total en Année 3
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Conversion Tab */}
        {activeTab === 'conversion' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
                Modèle Hybride : De la Carte NFC aux Revenus Récurrents
              </h2>
              <p className="text-center text-gray-600">
                Evolution de l&apos;entonnoir de conversion sur 3 ans
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FunnelYear
                data={funnelDataByYear.year1}
                year="Année 1"
                arr="€69.6k"
                subscribers="220"
                conversionRate="27.5%"
              />
              <FunnelYear
                data={funnelDataByYear.year2}
                year="Année 2"
                arr="€373.2k"
                subscribers="1 140"
                conversionRate="30%"
              />
              <FunnelYear
                data={funnelDataByYear.year3}
                year="Année 3"
                arr="€1.12M"
                subscribers="3 150"
                conversionRate="46%"
              />
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Indicateurs de Croissance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Croissance ARR</div>
                  <div className="text-3xl font-bold text-blue-600">×16.1</div>
                  <div className="text-xs text-gray-500 mt-1">Année 1 → Année 3</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Croissance Abonnés</div>
                  <div className="text-3xl font-bold text-green-600">×14.3</div>
                  <div className="text-xs text-gray-500 mt-1">220 → 3 150</div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Amélioration Conversion</div>
                  <div className="text-3xl font-bold text-purple-600">+18.5 pts</div>
                  <div className="text-xs text-gray-500 mt-1">27.5% → 46%</div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-5">
              <p className="text-sm text-gray-700 text-center">
                <strong>Stratégie :</strong> Les cartes NFC servent de canal d&apos;acquisition rentable,
                générant du cash-flow immédiat tout en construisant une base d&apos;utilisateurs que nous
                convertissons progressivement en abonnés SaaS à revenus récurrents. Le taux de conversion
                s&apos;améliore significativement avec la maturité du produit et l&apos;optimisation continue.
              </p>
            </div>
          </div>
        )}

        {/* Profitability Tab */}
        {activeTab === 'profitability' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">
                Évolution de la Marge Nette
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={plData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="marge"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Marge Nette (%)"
                    dot={{ fill: '#10b981', r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  Points Forts Financiers
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <div>
                      <strong>Rentabilité immédiate</strong>
                      <p className="text-sm text-gray-600">€46.8k de bénéfice dès l&apos;Année 1</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <div>
                      <strong>Burn Multiple = 0</strong>
                      <p className="text-sm text-gray-600">Top 1% en efficacité du capital</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <div>
                      <strong>Marges exceptionnelles</strong>
                      <p className="text-sm text-gray-600">92-96% de marge brute sur 3 ans</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-600 mr-2">✓</span>
                    <div>
                      <strong>Auto-financement</strong>
                      <p className="text-sm text-gray-600">Aucune dépendance aux investisseurs</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  Engagement des Fondateurs
                </h3>
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600 mb-2">
                      €0
                    </div>
                    <div className="text-sm text-gray-700">
                      Salaire des fondateurs<br/>Années 1, 2 et 3
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Cette décision stratégique maximise notre runway et démontre
                  notre conviction totale dans la réussite de Tapit. Les économies
                  réalisées (€232k sur 2 ans) sont réinvesties dans la croissance.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800 text-center">
                Positionnement par rapport aux Benchmarks
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">Croissance Année 2→3</div>
                  <div className="text-2xl font-bold text-blue-600">+192%</div>
                  <div className="text-xs text-green-600 mt-1">Top 10% SaaS</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">Taux Conversion</div>
                  <div className="text-2xl font-bold text-purple-600">46%</div>
                  <div className="text-xs text-green-600 mt-1">Bien au-dessus de la moyenne (2-10%)</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">Burn Multiple</div>
                  <div className="text-2xl font-bold text-green-600">0x</div>
                  <div className="text-xs text-green-600 mt-1">Top 1% (médiane: 1.6x)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 bg-white rounded-lg p-4">
          <p className="font-semibold mb-2">Tapit SAS - Projections Financières Conservatrices</p>
          <p>Document préparé le 15 octobre 2025</p>
          <p className="mt-2 text-xs">
            Projections basées sur des benchmarks industriels vérifiés et l&apos;analyse de l&apos;écosystème Grenoble
          </p>
        </div>
      </div>
    </div>
  );
};

export default TapitDashboard;
