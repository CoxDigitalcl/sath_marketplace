
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogoIcon } from './IconComponents';
import { Facebook, Instagram, Linkedin, Twitter, Share2, Heart } from 'lucide-react';

const Footer: React.FC = () => {
  const [socialLinks, setSocialLinks] = useState<any>({});

  useEffect(() => {
    const fetchSocialLinks = async () => {
      try {
        const response = await fetch('/api/public/settings/social_media');
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data) {
            setSocialLinks(data.data);
          }
        }
      } catch (error) {
        console.error("Error fetching social media links:", error);
      }
    };
    fetchSocialLinks();
  }, []);

  return (
    <footer className="bg-brand-dark text-white">
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <div className="flex items-center space-x-2 mb-6">
              <LogoIcon className="h-8 w-8 text-brand-light" />
              <span className="text-xl font-bold tracking-tight">Serviciosatuhogar</span>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">Únete a nuestra plataforma y mantente al tanto de las mejores ofertas y nuevos servicios en tu área.</p>
            <form className="flex shadow-md">
              <input type="email" placeholder="Tu correo electrónico" className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-l-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-primary text-sm transition-colors" />
              <button type="submit" className="bg-brand-primary hover:bg-brand-accent text-white font-medium py-2.5 px-4 rounded-r-lg transition-colors duration-300 text-sm">
                Suscribirse
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-300 tracking-wider uppercase mb-5">Explorar</h3>
            <ul className="space-y-3">
              <li><Link to="/categories/hogar" className="text-sm text-gray-400 hover:text-brand-light transition-colors text-left flex items-center group"><span className="w-0 h-px bg-brand-light transition-all duration-300 group-hover:w-2 mr-0 group-hover:mr-2"></span>Hogar y Mantención</Link></li>
              <li><Link to="/categories/salud" className="text-sm text-gray-400 hover:text-brand-light transition-colors text-left flex items-center group"><span className="w-0 h-px bg-brand-light transition-all duration-300 group-hover:w-2 mr-0 group-hover:mr-2"></span>Salud y Bienestar</Link></li>
              <li><Link to="/categories/clases" className="text-sm text-gray-400 hover:text-brand-light transition-colors text-left flex items-center group"><span className="w-0 h-px bg-brand-light transition-all duration-300 group-hover:w-2 mr-0 group-hover:mr-2"></span>Clases y Tutorías</Link></li>
              <li><Link to="/categories" className="text-sm text-brand-primary hover:text-brand-light font-medium transition-colors text-left mt-2 block">Ver todas las categorías &rarr;</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-300 tracking-wider uppercase mb-5">Soporte</h3>
            <ul className="space-y-3">
              <li><span className="text-sm text-gray-500">Centro de Ayuda (próximamente)</span></li>
              <li><a href="mailto:soporte@serviciosatuhogar.cl" className="text-sm text-gray-400 hover:text-brand-light transition-colors">Contacto</a></li>
              <li><Link to="/provider/register" className="text-sm text-gray-400 hover:text-brand-light transition-colors">Quiero ser Proveedor</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-300 tracking-wider uppercase mb-5">Legal & Empresa</h3>
            <ul className="space-y-3">
              <li><span className="text-sm text-gray-500">Sobre Nosotros (próximamente)</span></li>
              <li><Link to="/legal/terminos-y-condiciones-de-uso" className="text-sm text-gray-400 hover:text-brand-light transition-colors">Términos y Condiciones</Link></li>
              <li><Link to="/legal/politica-de-privacidad" className="text-sm text-gray-400 hover:text-brand-light transition-colors">Política de Privacidad</Link></li>
              <li className="pt-4"><Link to="/admin" className="text-xs text-gray-600 hover:text-brand-primary transition-colors">Acceso Administrativo</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center sm:items-start">
              <p className="text-sm text-gray-400 mb-1">&copy; {new Date().getFullYear()} Serviciosatuhogar. Todos los derechos reservados.</p>
              <p className="text-xs text-gray-500 flex items-center">
                 Hecho con <Heart size={12} className="text-red-500 fill-current mx-1 animate-pulse" /> por <a href="https://www.coxdigital.cl" target="_blank" rel="noopener noreferrer" className="text-brand-light hover:text-white hover:underline transition-color ml-1 font-medium tracking-wide">coxdigital</a>
              </p>
          </div>
          <div className="flex space-x-5 items-center">
            {socialLinks.facebook && <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-light transition-colors hover:scale-110 transform" aria-label="Facebook"><Facebook size={18} /></a>}
            {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-light transition-colors hover:scale-110 transform" aria-label="Instagram"><Instagram size={18} /></a>}
            {socialLinks.linkedin && <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-light transition-colors hover:scale-110 transform" aria-label="LinkedIn"><Linkedin size={18} /></a>}
            {socialLinks.twitter && <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-light transition-colors hover:scale-110 transform" aria-label="Twitter/X"><Twitter size={18} /></a>}
            {socialLinks.tiktok && <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-light transition-colors hover:scale-110 transform" aria-label="TikTok"><Share2 size={18} /></a>}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
