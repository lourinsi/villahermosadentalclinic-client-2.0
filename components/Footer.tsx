import { MapPin, Phone, Mail, Globe, Share2, Rss, Link } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold">SmileCare Dental</h3>
            <p className="text-gray-300 text-sm">
              Providing exceptional dental care to our community for over 15 years. 
              Your smile is our passion.
            </p>
            <div className="flex space-x-4">
              <Globe className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
              <Share2 className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
              <Rss className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
              <Link className="h-5 w-5 text-gray-400 hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#home" className="text-gray-300 hover:text-white transition-colors">Home</a></li>
              <li><a href="#services" className="text-gray-300 hover:text-white transition-colors">Services</a></li>
              <li><a href="#about" className="text-gray-300 hover:text-white transition-colors">About</a></li>
              <li><a href="#team" className="text-gray-300 hover:text-white transition-colors">Team</a></li>
              <li><a href="#contact" className="text-gray-300 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><span className="text-gray-300">Preventive Care</span></li>
              <li><span className="text-gray-300">Cosmetic Dentistry</span></li>
              <li><span className="text-gray-300">Restorative Care</span></li>
              <li><span className="text-gray-300">Emergency Care</span></li>
              <li><span className="text-gray-300">Orthodontics</span></li>
            </ul>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold">Contact Info</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300">123 Main Street<br />Downtown, CA 90210</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300">(555) 123-4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300">info@smilecaredental.com</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400">
          <p>&copy; 2024 SmileCare Dental. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">HIPAA Notice</a>
          </div>
        </div>
      </div>
    </footer>
  );
}