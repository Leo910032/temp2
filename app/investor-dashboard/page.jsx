'use client';

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TapitDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showControls, setShowControls] = useState(true);

  // Paramètres ajustables - Valeurs par défaut (scénario conservateur)
  const defaultParams = {
    // Prix des cartes
    prixPVC: 17.99,
    prixBois: 31.99,
    prixMetal: 39.99,

    // Volume de ventes (nombre de cartes par an)
    ventesAnnee1: 800,
    ventesAnnee2: 3000,
    ventesAnnee3: 6000,

    // Répartition des ventes (en %)
    partPVC: 50,
    partBois: 22,
    partMetal: 28,

    // SaaS
    prixSaasMensuel: 29,

    // Taux de conversion (%)
    tauxConversionAnnee1: 27.5,
    tauxConversionAnnee2: 38,
    tauxConversionAnnee3: 52.5,

    // Taux d'activation (%)
    tauxActivationAnnee1: 75,
    tauxActivationAnnee2: 95,
    tauxActivationAnnee3: 85,

    // Coûts
    coutsOperationnelsAnnee1: 16740,
    coutsOperationnelsAnnee2: 82300,
    coutsOperationnelsAnnee3: 504300,
  };

  const [params, setParams] = useState(defaultParams);

  // Fonction pour mettre à jour un paramètre
  const updateParam = (key, value) => {
    setParams(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  // Fonction pour réinitialiser
  const resetToDefaults = () => {
    setParams(defaultParams);
  };

  // Calculs dynamiques basés sur les paramètres
  const calculations = useMemo(() => {
    // Calcul CA Cartes par année
    const calculateCartesSales = (ventesAnnuelles) => {
      const nbPVC = Math.round(ventesAnnuelles * params.partPVC / 100);
      const nbBois = Math.round(ventesAnnuelles * params.partBois / 100);
      const nbMetal = Math.round(ventesAnnuelles * params.partMetal / 100);

      return {
        PVC: Math.round(nbPVC * params.prixPVC),
        Bois: Math.round(nbBois * params.prixBois),
        Métal: Math.round(nbMetal * params.prixMetal),
        nbPVC,
        nbBois,
        nbMetal
      };
    };

    const cartesY1 = calculateCartesSales(params.ventesAnnee1);
    const cartesY2 = calculateCartesSales(params.ventesAnnee2);
    const cartesY3 = calculateCartesSales(params.ventesAnnee3);

    // Calcul des abonnés
    const ventesCumuléesY1 = params.ventesAnnee1;
    const ventesCumuléesY2 = params.ventesAnnee1 + params.ventesAnnee2;
    const ventesCumuléesY3 = params.ventesAnnee1 + params.ventesAnnee2 + params.ventesAnnee3;

    const utilisateursActifsY1 = Math.round(ventesCumuléesY1 * params.tauxActivationAnnee1 / 100);
    const utilisateursActifsY2 = Math.round(ventesCumuléesY2 * params.tauxActivationAnnee2 / 100);
    const utilisateursActifsY3 = Math.round(ventesCumuléesY3 * params.tauxActivationAnnee3 / 100);

    const abonnesY1 = Math.round(ventesCumuléesY1 * params.tauxConversionAnnee1 / 100);
    const abonnesY2 = Math.round(ventesCumuléesY2 * params.tauxConversionAnnee2 / 100);
    const abonnesY3 = Math.round(ventesCumuléesY3 * params.tauxConversionAnnee3 / 100);

    // Calcul ARR (fin d'année)
    const arrY1 = abonnesY1 * params.prixSaasMensuel * 12;
    const arrY2 = abonnesY2 * params.prixSaasMensuel * 12;
    const arrY3 = abonnesY3 * params.prixSaasMensuel * 12;

    // CA SaaS (moyenne de l'année)
    const caSaasY1 = Math.round(arrY1 * 0.5); // Montée progressive en année 1
    const caSaasY2 = Math.round((arrY1 + arrY2) / 2); // Moyenne entre début et fin
    const caSaasY3 = Math.round((arrY2 + arrY3) / 2);

    // CA Total
    const caTotalCartesY1 = cartesY1.PVC + cartesY1.Bois + cartesY1.Métal;
    const caTotalCartesY2 = cartesY2.PVC + cartesY2.Bois + cartesY2.Métal;
    const caTotalCartesY3 = cartesY3.PVC + cartesY3.Bois + cartesY3.Métal;

    const caY1 = caSaasY1 + caTotalCartesY1;
    const caY2 = caSaasY2 + caTotalCartesY2;
    const caY3 = caSaasY3 + caTotalCartesY3;

    // Résultats
    const resultatY1 = caY1 - params.coutsOperationnelsAnnee1;
    const resultatY2 = caY2 - params.coutsOperationnelsAnnee2;
    const resultatY3 = caY3 - params.coutsOperationnelsAnnee3;

    // Marges
    const margeY1 = caY1 > 0 ? (resultatY1 / caY1) * 100 : 0;
    const margeY2 = caY2 > 0 ? (resultatY2 / caY2) * 100 : 0;
    const margeY3 = caY3 > 0 ? (resultatY3 / caY3) * 100 : 0;

    return {
      cartesY1, cartesY2, cartesY3,
      caTotalCartesY1, caTotalCartesY2, caTotalCartesY3,
      utilisateursActifsY1, utilisateursActifsY2, utilisateursActifsY3,
      abonnesY1, abonnesY2, abonnesY3,
      arrY1, arrY2, arrY3,
      caSaasY1, caSaasY2, caSaasY3,
      caY1, caY2, caY3,
      resultatY1, resultatY2, resultatY3,
      margeY1, margeY2, margeY3,
      ventesCumuléesY1, ventesCumuléesY2, ventesCumuléesY3
    };
  }, [params]);

  // Données CA Cartes par type
  const cartesSalesData = [
    { year: 'Année 1', PVC: calculations.cartesY1.PVC, Bois: calculations.cartesY1.Bois, Métal: calculations.cartesY1.Métal },
    { year: 'Année 2', PVC: calculations.cartesY2.PVC, Bois: calculations.cartesY2.Bois, Métal: calculations.cartesY2.Métal },
    { year: 'Année 3', PVC: calculations.cartesY3.PVC, Bois: calculations.cartesY3.Bois, Métal: calculations.cartesY3.Métal }
  ];

  // Données ARR évolution mensuelle (simplifiée pour l'exemple)
  const arrEvolutionData = useMemo(() => {
    const data = [];
    for (let month = 3; month <= 36; month += 3) {
      const year = Math.ceil(month / 12);
      const progress = (month % 12) / 12 || 1;

      let arr, ventesCumul;

      if (year === 1) {
        arr = calculations.arrY1 * progress;
        ventesCumul = calculations.caTotalCartesY1 * progress;
      } else if (year === 2) {
        arr = calculations.arrY1 + (calculations.arrY2 - calculations.arrY1) * progress;
        ventesCumul = calculations.caTotalCartesY1 + calculations.caTotalCartesY2 * progress;
      } else {
        arr = calculations.arrY2 + (calculations.arrY3 - calculations.arrY2) * progress;
        ventesCumul = calculations.caTotalCartesY1 + calculations.caTotalCartesY2 + calculations.caTotalCartesY3 * progress;
      }

      data.push({
        mois: `M${month}`,
        arr: Math.round(arr),
        cartesCumul: Math.round(ventesCumul)
      });
    }
    return data;
  }, [calculations]);

  // Données répartition CA Année 3
  const revenueBreakdownY3 = [
    { name: 'CA SaaS', value: calculations.caSaasY3, color: '#10b981' },
    { name: 'CA Cartes', value: calculations.caTotalCartesY3, color: '#3b82f6' }
  ];

  // Données P&L
  const plData = [
    {
      year: 'Année 1',
      ca: calculations.caY1,
      charges: params.coutsOperationnelsAnnee1,
      resultat: calculations.resultatY1,
      marge: calculations.margeY1
    },
    {
      year: 'Année 2',
      ca: calculations.caY2,
      charges: params.coutsOperationnelsAnnee2,
      resultat: calculations.resultatY2,
      marge: calculations.margeY2
    },
    {
      year: 'Année 3',
      ca: calculations.caY3,
      charges: params.coutsOperationnelsAnnee3,
      resultat: calculations.resultatY3,
      marge: calculations.margeY3
    }
  ];

  // Données entonnoirs de conversion
  const funnelDataByYear = {
    year1: [
      { stage: 'Ventes de Cartes NFC', value: params.ventesAnnee1, percent: 100, color: '#3b82f6' },
      { stage: 'Utilisateurs Actifs', value: calculations.utilisateursActifsY1, percent: params.tauxActivationAnnee1, color: '#8b5cf6' },
      { stage: 'Abonnés SaaS', value: calculations.abonnesY1, percent: params.tauxConversionAnnee1, color: '#10b981' }
    ],
    year2: [
      { stage: 'Ventes de Cartes NFC', value: params.ventesAnnee2, percent: 100, color: '#3b82f6' },
      { stage: 'Utilisateurs Actifs', value: calculations.utilisateursActifsY2, percent: params.tauxActivationAnnee2, color: '#8b5cf6' },
      { stage: 'Abonnés SaaS', value: calculations.abonnesY2, percent: params.tauxConversionAnnee2, color: '#10b981' }
    ],
    year3: [
      { stage: 'Ventes de Cartes NFC', value: params.ventesAnnee3, percent: 100, color: '#3b82f6' },
      { stage: 'Utilisateurs Actifs', value: calculations.utilisateursActifsY3, percent: params.tauxActivationAnnee3, color: '#8b5cf6' },
      { stage: 'Abonnés SaaS', value: calculations.abonnesY3, percent: params.tauxConversionAnnee3, color: '#10b981' }
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

  // Composant de contrôle avec slider
  const ControlSlider = ({ label, value, onChange, min, max, step, unit = '', description }) => (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min={min}
            max={max}
            step={step}
          />
          <span className="text-sm text-gray-600">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  );

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Tapit SAS - Projections Financières Interactives
          </h1>
          <p className="text-lg text-gray-600">
            Ajustez les paramètres pour explorer différents scénarios
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full">
              <span className="font-semibold">
                {calculations.resultatY1 > 0 ? '✓ Rentable dès l\'Année 1' : '⚠️ Non rentable Année 1'}
              </span>
            </div>
            <button
              onClick={() => setShowControls(!showControls)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium transition-colors"
            >
              {showControls ? '🎛️ Masquer les contrôles' : '🎛️ Afficher les contrôles'}
            </button>
          </div>
        </div>

        {/* Panneau de contrôle */}
        {showControls && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Paramètres Ajustables</h2>
              <button
                onClick={resetToDefaults}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              >
                ↺ Réinitialiser
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Section Prix */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-bold text-gray-700 mb-3">💳 Prix des Cartes</h3>
                <ControlSlider
                  label="Carte PVC"
                  value={params.prixPVC}
                  onChange={(v) => updateParam('prixPVC', v)}
                  min={10}
                  max={50}
                  step={0.99}
                  unit="€"
                />
                <ControlSlider
                  label="Carte Bois"
                  value={params.prixBois}
                  onChange={(v) => updateParam('prixBois', v)}
                  min={15}
                  max={60}
                  step={0.99}
                  unit="€"
                />
                <ControlSlider
                  label="Carte Métal"
                  value={params.prixMetal}
                  onChange={(v) => updateParam('prixMetal', v)}
                  min={20}
                  max={80}
                  step={0.99}
                  unit="€"
                />
              </div>

              {/* Section Volume */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-bold text-gray-700 mb-3">📊 Volume de Ventes</h3>
                <ControlSlider
                  label="Cartes Année 1"
                  value={params.ventesAnnee1}
                  onChange={(v) => updateParam('ventesAnnee1', v)}
                  min={100}
                  max={3000}
                  step={100}
                  unit="cartes"
                />
                <ControlSlider
                  label="Cartes Année 2"
                  value={params.ventesAnnee2}
                  onChange={(v) => updateParam('ventesAnnee2', v)}
                  min={500}
                  max={10000}
                  step={100}
                  unit="cartes"
                />
                <ControlSlider
                  label="Cartes Année 3"
                  value={params.ventesAnnee3}
                  onChange={(v) => updateParam('ventesAnnee3', v)}
                  min={1000}
                  max={20000}
                  step={100}
                  unit="cartes"
                />
              </div>

              {/* Section Mix Produits */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-bold text-gray-700 mb-3">🎨 Mix Produits</h3>
                <ControlSlider
                  label="Part PVC"
                  value={params.partPVC}
                  onChange={(v) => updateParam('partPVC', v)}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <ControlSlider
                  label="Part Bois"
                  value={params.partBois}
                  onChange={(v) => updateParam('partBois', v)}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <ControlSlider
                  label="Part Métal"
                  value={params.partMetal}
                  onChange={(v) => updateParam('partMetal', v)}
                  min={0}
                  max={100}
                  step={5}
                  unit="%"
                />
                <p className="text-xs text-amber-600 mt-2">
                  Total: {params.partPVC + params.partBois + params.partMetal}%
                  {params.partPVC + params.partBois + params.partMetal !== 100 && ' ⚠️ Devrait = 100%'}
                </p>
              </div>

              {/* Section SaaS */}
              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-bold text-gray-700 mb-3">💎 SaaS</h3>
                <ControlSlider
                  label="Prix Abonnement"
                  value={params.prixSaasMensuel}
                  onChange={(v) => updateParam('prixSaasMensuel', v)}
                  min={9}
                  max={99}
                  step={1}
                  unit="€/mois"
                />
              </div>

              {/* Section Conversion */}
              <div className="border-l-4 border-pink-500 pl-4">
                <h3 className="font-bold text-gray-700 mb-3">🎯 Taux de Conversion</h3>
                <ControlSlider
                  label="Conversion Année 1"
                  value={params.tauxConversionAnnee1}
                  onChange={(v) => updateParam('tauxConversionAnnee1', v)}
                  min={5}
                  max={80}
                  step={0.5}
                  unit="%"
                  description="Cartes → Abonnés payants"
                />
                <ControlSlider
                  label="Conversion Année 2"
                  value={params.tauxConversionAnnee2}
                  onChange={(v) => updateParam('tauxConversionAnnee2', v)}
                  min={5}
                  max={80}
                  step={0.5}
                  unit="%"
                />
                <ControlSlider
                  label="Conversion Année 3"
                  value={params.tauxConversionAnnee3}
                  onChange={(v) => updateParam('tauxConversionAnnee3', v)}
                  min={5}
                  max={80}
                  step={0.5}
                  unit="%"
                />
              </div>

              {/* Section Coûts */}
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-bold text-gray-700 mb-3">💰 Coûts Opérationnels</h3>
                <ControlSlider
                  label="Coûts Année 1"
                  value={params.coutsOperationnelsAnnee1}
                  onChange={(v) => updateParam('coutsOperationnelsAnnee1', v)}
                  min={5000}
                  max={100000}
                  step={1000}
                  unit="€"
                />
                <ControlSlider
                  label="Coûts Année 2"
                  value={params.coutsOperationnelsAnnee2}
                  onChange={(v) => updateParam('coutsOperationnelsAnnee2', v)}
                  min={10000}
                  max={200000}
                  step={1000}
                  unit="€"
                />
                <ControlSlider
                  label="Coûts Année 3"
                  value={params.coutsOperationnelsAnnee3}
                  onChange={(v) => updateParam('coutsOperationnelsAnnee3', v)}
                  min={50000}
                  max={1000000}
                  step={10000}
                  unit="€"
                />
              </div>
            </div>
          </div>
        )}

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
                <div className="text-3xl font-bold text-blue-600">
                  €{(calculations.caY3 / 1000).toFixed(0)}k
                </div>
                <div className="text-xs text-green-600 mt-1">
                  +{((calculations.caY3 / calculations.caY2 - 1) * 100).toFixed(0)}% vs Année 2
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-600 mb-1">ARR Année 3</div>
                <div className="text-3xl font-bold text-green-600">
                  €{(calculations.arrY3 / 1000000).toFixed(2)}M
                </div>
                <div className="text-xs text-green-600 mt-1">
                  +{((calculations.arrY3 / calculations.arrY2 - 1) * 100).toFixed(0)}% vs Année 2
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-600 mb-1">Bénéfice Année 3</div>
                <div className={`text-3xl font-bold ${calculations.resultatY3 > 0 ? 'text-purple-600' : 'text-red-600'}`}>
                  €{(calculations.resultatY3 / 1000).toFixed(0)}k
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  {calculations.margeY3.toFixed(1)}% marge nette
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-600 mb-1">Abonnés Payants</div>
                <div className="text-3xl font-bold text-indigo-600">
                  {calculations.abonnesY3.toLocaleString('fr-FR')}
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                  {params.tauxConversionAnnee3.toFixed(1)}% conversion cumulée
                </div>
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
                    <div className={`text-lg font-bold ${year.marge > 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                  Le SaaS représente <strong className="text-green-600">
                    {((calculations.caSaasY3 / calculations.caY3) * 100).toFixed(1)}%
                  </strong> du CA total en Année 3
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
                arr={`€${(calculations.arrY1 / 1000).toFixed(1)}k`}
                subscribers={calculations.abonnesY1.toLocaleString('fr-FR')}
                conversionRate={`${params.tauxConversionAnnee1}%`}
              />
              <FunnelYear
                data={funnelDataByYear.year2}
                year="Année 2"
                arr={`€${(calculations.arrY2 / 1000).toFixed(1)}k`}
                subscribers={calculations.abonnesY2.toLocaleString('fr-FR')}
                conversionRate={`${params.tauxConversionAnnee2}%`}
              />
              <FunnelYear
                data={funnelDataByYear.year3}
                year="Année 3"
                arr={`€${(calculations.arrY3 / 1000000).toFixed(2)}M`}
                subscribers={calculations.abonnesY3.toLocaleString('fr-FR')}
                conversionRate={`${params.tauxConversionAnnee3}%`}
              />
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Indicateurs de Croissance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Croissance ARR</div>
                  <div className="text-3xl font-bold text-blue-600">
                    ×{(calculations.arrY3 / calculations.arrY1).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Année 1 → Année 3</div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Croissance Abonnés</div>
                  <div className="text-3xl font-bold text-green-600">
                    ×{(calculations.abonnesY3 / calculations.abonnesY1).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {calculations.abonnesY1} → {calculations.abonnesY3}
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-sm text-gray-600 mb-1">Amélioration Conversion</div>
                  <div className="text-3xl font-bold text-purple-600">
                    +{(params.tauxConversionAnnee3 - params.tauxConversionAnnee1).toFixed(1)} pts
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {params.tauxConversionAnnee1}% → {params.tauxConversionAnnee3}%
                  </div>
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
                  Métriques de Performance
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">CA Année 3</span>
                    <span className="text-lg font-bold text-blue-600">
                      €{(calculations.caY3 / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">Charges Année 3</span>
                    <span className="text-lg font-bold text-red-600">
                      €{(params.coutsOperationnelsAnnee3 / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium text-gray-700">Résultat Année 3</span>
                    <span className={`text-lg font-bold ${calculations.resultatY3 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      €{(calculations.resultatY3 / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <span className="text-sm font-medium text-gray-700">Marge Nette</span>
                    <span className={`text-lg font-bold ${calculations.margeY3 > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {calculations.margeY3.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  Résultats sur 3 ans
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Année 1', resultat: calculations.resultatY1, ca: calculations.caY1 },
                    { label: 'Année 2', resultat: calculations.resultatY2, ca: calculations.caY2 },
                    { label: 'Année 3', resultat: calculations.resultatY3, ca: calculations.caY3 }
                  ].map((year) => (
                    <div key={year.label} className="p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{year.label}</span>
                        <span className={`text-lg font-bold ${year.resultat > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {year.resultat > 0 ? '+' : ''}{(year.resultat / 1000).toFixed(0)}k €
                        </span>
                      </div>
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${year.resultat > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(Math.abs((year.resultat / year.ca) * 100), 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800 text-center">
                Analyse de Rentabilité
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">Seuil de Rentabilité</div>
                  <div className={`text-2xl font-bold ${calculations.resultatY1 > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {calculations.resultatY1 > 0 ? 'Année 1' : calculations.resultatY2 > 0 ? 'Année 2' : 'Année 3+'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Premier résultat positif</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">Bénéfice Cumulé 3 ans</div>
                  <div className={`text-2xl font-bold ${(calculations.resultatY1 + calculations.resultatY2 + calculations.resultatY3) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{((calculations.resultatY1 + calculations.resultatY2 + calculations.resultatY3) / 1000).toFixed(0)}k
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Total net</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-sm text-gray-600 mb-1">ROI Investisseur</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {calculations.caY3 > 0 ? ((calculations.resultatY3 / params.coutsOperationnelsAnnee3) * 100).toFixed(0) : '0'}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Année 3</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 bg-white rounded-lg p-4">
          <p className="font-semibold mb-2">Tapit SAS - Outil de Simulation Financière</p>
          <p>Version Interactive - Mise à jour Octobre 2025</p>
          <p className="mt-2 text-xs">
            Les projections sont basées sur vos paramètres personnalisés. Scénario conservateur par défaut.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TapitDashboard;
