
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../../types';
import { Search, ArrowRight } from 'lucide-react';
import { 
    WrenchScrewdriverIcon, AcademicCapIcon, HeartIcon, 
    TruckIcon, CakeIcon, CarIcon, GiftIcon
} from '../IconComponents';
import WebGLParticleBackground from './WebGLParticleBackground';
import LocationCoverageSelector from '../common/LocationCoverageSelector';

interface CategoriesHubPageProps {
  navigateTo: (page: Page, params?: any) => void;
}

// Categories Data Configuration matched with PDF
const categories = [
    { id: 'hogar', name: 'Hogar y Mantención', description: 'Limpieza, reparaciones, calefacción, jardín y más.', icon: WrenchScrewdriverIcon, featured: true, image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=870&auto=format&fit=crop' },
    { id: 'clases', name: 'Clases', description: 'Escolares, idiomas, música, deportes y más.', icon: AcademicCapIcon, featured: true, image: 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?q=80&w=2070&auto=format&fit=crop' },
    { id: 'salud', name: 'Salud y Bienestar', description: 'Médicos, psicólogos, enfermería y estética.', icon: HeartIcon, featured: true, image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=2070&auto=format&fit=crop' },
    { id: 'eventos', name: 'Eventos y Entret.', description: 'Banquetera, animación, decoración y cumpleaños.', icon: CakeIcon, featured: true, image: 'https://images.unsplash.com/photo-1530103862676-de3c9a59af38?q=80&w=2000&auto=format&fit=crop' },
    { id: 'automoviles', name: 'Automóviles', description: 'Mecánica, grúas, lavado y mantención.', icon: CarIcon, featured: false },
    { id: 'fletes', name: 'Fletes', description: 'Mudanzas, retiro de escombros y encomiendas.', icon: TruckIcon, featured: false },
    { id: 'colegio', name: 'Colegio', description: 'Charlas educativas, regalos y actividades.', icon: GiftIcon, featured: false },
];

const CategoriesHubPage: React.FC<CategoriesHubPageProps> = ({ navigateTo }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegionCode, setSelectedRegionCode] = useState('');
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);

  const handleSearch = () => {
    navigateTo('search', {
      q: searchTerm.trim(),
      region: selectedRegionCode,
      communes: selectedRegionCode ? selectedCommunes : [],
    });
  };

  const getCategoryPath = (category: { id: string; name: string }) => {
    const params = new URLSearchParams();
    if (selectedRegionCode) params.set('region', selectedRegionCode);
    if (selectedRegionCode && selectedCommunes.length > 0) {
      params.set('commune', selectedCommunes.join(','));
    }
    const queryString = params.toString();
    return `/categories/${category.id}${queryString ? `?${queryString}` : ''}`;
  };

  return (
    <div className="bg-gray-50 min-h-screen pb-12">
        {/* Hero Section Premium WebGL */}
        <div className="relative text-white py-24 sm:py-32 overflow-hidden bg-slate-950">
             {/* WebGL Animated Background */}
             <WebGLParticleBackground />
             
             {/* Vignette Overlay for readability */}
             <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/90 pointer-events-none z-10"></div>

             <div className="container mx-auto px-4 relative z-20 text-center">
                 <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mx-auto max-w-4xl leading-tight mb-6 drop-shadow-2xl text-white">
                    Explora todas las categorías
                 </h1>
                 <p className="text-lg sm:text-xl text-brand-light/90 max-w-2xl mx-auto mb-10 drop-shadow-md">
                     Encuentra el profesional exacto para lo que necesitas, a través de nuestra red neuronal de servicios.
                 </p>
                 <div className="max-w-3xl mx-auto relative group">
                     {/* Borde reactivo luminoso */}
                     <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-brand-accent rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                     <div className="relative bg-white/10 backdrop-blur-md border border-white/20 rounded-full p-2 flex items-center transition-all duration-300 focus-within:bg-white/20 focus-within:border-white/40 shadow-2xl">
                         <div className="pl-4 pr-3">
                             <Search className="h-6 w-6 text-brand-light" />
                         </div>
                         <input 
                            type="text" 
                            placeholder="¿Qué servicio o profesional necesitas?" 
                            className="w-full py-3 bg-transparent text-white placeholder-brand-light/70 focus:outline-none text-lg"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                         />
                         <button 
                            onClick={handleSearch}
                            className="bg-brand-primary hover:bg-brand-accent transition-colors text-white px-8 py-3 rounded-full font-semibold shadow-lg hidden sm:block"
                         >
                             Buscar
                         </button>
                     </div>
                     <div className="relative mt-5 rounded-2xl border border-white/20 bg-white/95 p-4 text-left shadow-2xl backdrop-blur-md">
                        <LocationCoverageSelector
                          regionCode={selectedRegionCode}
                          communes={selectedCommunes}
                          onRegionChange={setSelectedRegionCode}
                          onCommunesChange={setSelectedCommunes}
                          mode="multiple"
                          label="Filtrar por ubicacion"
                          helperText="Elige una o mas comunas para ampliar tu busqueda a localidades cercanas."
                        />
                     </div>
                 </div>
             </div>
        </div>

        <div className="container mx-auto px-4 -mt-8 relative z-20">
            
            {/* Featured Categories (Level 1 Hierarchy) */}
            <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Categorías Destacadas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {categories.filter(c => c.featured).map(category => (
                        <Link
                            key={category.id}
                            to={getCategoryPath(category)}
                            state={{ id: category.id, name: category.name }}
                            className="group relative h-64 rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                        >
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors z-10"></div>
                            <img
                                src={category.image}
                                alt={category.name}
                                loading="lazy"
                                decoding="async"
                                width={870}
                                height={580}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            <div className="absolute bottom-0 left-0 p-6 z-20 text-white">
                                <div className="flex items-center mb-2">
                                    <div className="p-2 bg-brand-primary rounded-full mr-3">
                                        <category.icon className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold">{category.name}</h3>
                                </div>
                                <p className="text-sm text-gray-200 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                                    {category.description}
                                </p>
                                <span className="text-sm font-semibold flex items-center hover:underline">
                                    Explorar <ArrowRight size={16} className="ml-1" />
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* All Categories Grid (Level 2 Hierarchy) */}
            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Otras Categorías</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categories.filter(c => !c.featured).map(category => (
                        <Link
                            key={category.id}
                            to={getCategoryPath(category)}
                            state={{ id: category.id, name: category.name }}
                            className="bg-white p-6 rounded-lg border border-gray-200 hover:border-brand-primary hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group"
                        >
                            <div className="h-12 w-12 rounded-full bg-brand-light flex items-center justify-center mb-3 group-hover:bg-brand-primary/10 transition-colors">
                                <category.icon className="h-6 w-6 text-gray-600 group-hover:text-brand-primary" />
                            </div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-brand-primary">{category.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                        </Link>
                    ))}
                </div>
            </div>

        </div>
    </div>
  );
};

export default CategoriesHubPage;
