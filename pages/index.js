import React, { useState, useEffect } from 'react';
import { HoverBorderGradient } from '../components/ui/hover-border-gradient';

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [reportData, setReportData] = useState({
    patientName: '',
    age: '',
    gender: 'male',
    symptoms: '',
    urgency: 'normal',
    uploadedReports: []
  });
  
  const [selectedReportTypes, setSelectedReportTypes] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [userLocation, setUserLocation] = useState({
    latitude: null,
    longitude: null,
    address: null,
    city: null,
    country: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    setIsVisible(true);
    // Auto-request location on component mount
    requestLocation();
  }, []);

  // Location detection functions
  const requestLocation = () => {
    setUserLocation(prev => ({ ...prev, loading: true, error: null }));
    
    if (!navigator.geolocation) {
      setUserLocation(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by this browser'
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Reverse geocoding to get address
          const address = await reverseGeocode(latitude, longitude);
          
          setUserLocation({
            latitude,
            longitude,
            address: address.formatted_address,
            city: address.city,
            country: address.country,
            loading: false,
            error: null
          });
        } catch (error) {
          setUserLocation({
            latitude,
            longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            city: 'Unknown',
            country: 'Unknown',
            loading: false,
            error: null
          });
        }
      },
      (error) => {
        let errorMessage = 'Unable to retrieve location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        
        setUserLocation(prev => ({
          ...prev,
          loading: false,
          error: errorMessage
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  // Reverse geocoding function (using a free geocoding service)
  const reverseGeocode = async (latitude, longitude) => {
    try {
      // Using OpenStreetMap Nominatim (free service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }
      
      const data = await response.json();
      
      return {
        formatted_address: data.display_name || `${latitude}, ${longitude}`,
        city: data.address?.city || data.address?.town || data.address?.village || 'Unknown',
        country: data.address?.country || 'Unknown'
      };
    } catch (error) {
      throw error;
    }
  };

  // Comprehensive medical test categories
  const medicalTestCategories = {
    'Blood Tests': {
      icon: '🩸',
      tests: [
        'Complete Blood Count (CBC)',
        'Liver Function Test (LFT)',
        'Kidney Function Test (KFT)',
        'Lipid Profile',
        'Thyroid Profile (T3, T4, TSH)',
        'Blood Sugar (Fasting/Random/HbA1c)',
        'Vitamin D3, B12, Iron Studies',
        'Hepatitis B Surface Antigen (HBsAg)',
        'Anti-HCV (Hepatitis C)',
        'HIV Test',
        'Cardiac Markers (Troponin, CK-MB)',
        'Inflammatory Markers (ESR, CRP)',
        'Tumor Markers (PSA, CA 125, AFP)',
        'Hormonal Tests (Testosterone, Estrogen)',
        'Coagulation Studies (PT/INR, APTT)',
      ]
    },
    'Imaging Reports': {
      icon: '📋',
      tests: [
        'X-Ray (Chest, Abdomen, Joints)',
        'CT Scan (Head, Chest, Abdomen)',
        'MRI Scan (Brain, Spine, Joints)',
        'Ultrasound (Abdomen, Pelvis, Thyroid)',
        'Mammography',
        'DEXA Scan (Bone Density)',
        'PET Scan',
        'Angiography',
      ]
    },
    'Cardiac Tests': {
      icon: '❤️',
      tests: [
        'ECG/EKG (Electrocardiogram)',
        'Echocardiography (2D Echo)',
        'Stress Test (TMT)',
        'Holter Monitor',
        'Cardiac Catheterization',
      ]
    },
    'Specialized Tests': {
      icon: '🔬',
      tests: [
        'Biopsy Reports',
        'Pathology Reports',
        'Endoscopy Reports',
        'Colonoscopy Reports',
        'Pulmonary Function Test (PFT)',
        'Sleep Study',
        'Allergy Tests',
        'Genetic Tests',
      ]
    },
    'Urine & Fluid Analysis': {
      icon: '🧪',
      tests: [
        'Urine Routine & Microscopy',
        'Urine Culture',
        '24-Hour Urine Collection',
        'Cerebrospinal Fluid (CSF) Analysis',
        'Pleural Fluid Analysis',
        'Ascitic Fluid Analysis',
      ]
    }
  };

  const toggleReportType = (test) => {
    setSelectedReportTypes(prev => 
      prev.includes(test) 
        ? prev.filter(t => t !== test)
        : [...prev, test]
    );
  };

  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorState, setErrorState] = useState(null);

  // File upload handlers
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    handleFiles(files);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleFiles = (files) => {
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/dicom'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.dcm')) {
        alert(`File ${file.name} is not a supported format. Please upload PDF, JPG, PNG, or DICOM files.`);
        return false;
      }
      
      if (file.size > maxSize) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      return true;
    });

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one medical report file.');
      return;
    }
    
    if (!reportData.patientName.trim()) {
      alert('Please enter the patient name.');
      return;
    }

    setAnalysisLoading(true);
    setAnalysisResult(null);
    setErrorState(null);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add files
      uploadedFiles.forEach((file, index) => {
        formData.append(`files`, file);
      });
      
      // Add other data as JSON string
      formData.append('data', JSON.stringify({
        medicalData: selectedReportTypes,
        patientInfo: {
          name: reportData.patientName,
          age: reportData.age,
          gender: reportData.gender,
          symptoms: reportData.symptoms,
          urgency: reportData.urgency
        },
        location: {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          address: userLocation.address,
          city: userLocation.city,
          country: userLocation.country
        }
      }));
      
      // Call the Gemini API for analysis
      const response = await fetch('/api/analyze-medical-data', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setAnalysisResult(result.analysis);
        const locationInfo = userLocation.city 
          ? `\nLocation: ${userLocation.city}, ${userLocation.country}`
          : userLocation.error 
            ? '\nLocation: Not available'
            : '';
            
        alert(`AI Analysis Complete! \n\nFiles uploaded: ${uploadedFiles.length}${locationInfo}\nPlease check the hospital recommendations below.`);
      } else {
        // Handle specific API errors
        if (response.status === 503) {
          setErrorState({
            type: 'service_unavailable',
            title: 'AI Service Temporarily Unavailable',
            message: result.message || 'The AI service is experiencing high demand. Please try again in a few minutes.',
            retryable: true
          });
        } else if (response.status === 429) {
          setErrorState({
            type: 'rate_limited',
            title: 'Too Many Requests',
            message: result.message || 'You have made too many requests. Please wait a moment before trying again.',
            retryable: true
          });
        } else {
          setErrorState({
            type: 'general_error',
            title: 'Analysis Failed',
            message: result.error || result.details || 'An unexpected error occurred during analysis.',
            retryable: true
          });
        }
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error during analysis:', error);
      
      // Only show generic alert if we don't have a specific error state
      if (!errorState) {
        setErrorState({
          type: 'network_error',
          title: 'Connection Error',
          message: 'Unable to connect to the analysis service. Please check your internet connection and try again.',
          retryable: true
        });
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-50">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse animation-delay-4000"></div>
        </div>
        
        {/* Floating Particles */}
        <div className="absolute inset-0">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full opacity-20 animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">HealthTech AI</span>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <a href="#home" className="text-gray-300 hover:text-white transition-colors duration-300">Home</a>
            <a href="#about" className="text-gray-300 hover:text-white transition-colors duration-300">About</a>
            <a href="#report" className="text-gray-300 hover:text-white transition-colors duration-300">Report</a>
            
            {/* Location Status */}
            <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-full border border-white/20">
              {userLocation.loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-gray-300">Getting location...</span>
                </div>
              ) : userLocation.error ? (
                <button
                  onClick={requestLocation}
                  className="flex items-center space-x-2 text-yellow-300 hover:text-white transition-colors duration-300"
                  title={userLocation.error}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs">Enable Location</span>
                </button>
              ) : userLocation.city ? (
                <div className="flex items-center space-x-2 text-green-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs" title={userLocation.address}>
                    {userLocation.city}, {userLocation.country}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative z-10 px-6 py-20">
        <div className={`max-w-7xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            The Future of
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"> Healthcare</span>
            <br />is Here
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto">
            Experience revolutionary AI-powered medical analysis with cutting-edge technology. 
            Upload your medical reports and get instant, accurate health insights powered by advanced machine learning.
          </p>
          <div className="flex justify-center">
            <HoverBorderGradient
              containerClassName="rounded-full"
              as="button"
              onClick={() => document.getElementById('report').scrollIntoView({ behavior: 'smooth' })}
              className="dark:bg-black bg-black text-white dark:text-white px-8 py-4 text-lg font-semibold flex items-center space-x-2"
              duration={2}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Start Analysis</span>
            </HoverBorderGradient>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative z-10 px-6 py-16">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { number: '1M+', label: 'Reports Analyzed' },
            { number: '95.96%', label: 'Accuracy Rate' },
            { number: '24/7', label: 'AI Support' },
            { number: '150+', label: 'Medical Conditions' }
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.number}</div>
                <div className="text-gray-300">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative z-10 px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              About <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">HealthTech AI</span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              We're revolutionizing healthcare through artificial intelligence, providing instant medical insights and personalized health recommendations.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'AI-Powered Analysis',
                description: 'Our advanced machine learning algorithms analyze your medical reports with unprecedented accuracy and speed.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )
              },
              {
                title: 'Instant Results',
                description: 'Get comprehensive health insights within seconds of uploading your medical reports and test results.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )
              },
              {
                title: 'Secure & Private',
                description: 'Your medical data is encrypted and protected with enterprise-grade security protocols and privacy measures.',
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )
              }
            ].map((feature, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:transform hover:scale-105">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
                <p className="text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comprehensive Medical Report Upload Section */}
      <section id="report" className="relative z-10 px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Comprehensive <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Medical Analysis</span>
            </h2>
            <p className="text-xl text-gray-300 mb-4">
              Upload ALL your medical reports for complete AI-powered health assessment
            </p>
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl p-4 border border-blue-400/30">
              <p className="text-blue-200 text-sm">
                💡 <strong>Pro Tip:</strong> For conditions like Hepatitis, upload LFT, HBsAg, Anti-HCV tests together for accurate diagnosis
              </p>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
            <form onSubmit={handleReportSubmit} className="space-y-8">
              {/* Patient Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Patient Name *
                  </label>
                  <input
                    type="text"
                    value={reportData.patientName}
                    onChange={(e) => setReportData({...reportData, patientName: e.target.value})}
                    className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    placeholder="Enter patient name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    value={reportData.age}
                    onChange={(e) => setReportData({...reportData, age: e.target.value})}
                    className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    placeholder="Age"
                    min="1"
                    max="120"
                  />
                </div>
                
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Gender
                  </label>
                  <select
                    value={reportData.gender}
                    onChange={(e) => setReportData({...reportData, gender: e.target.value})}
                    className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  >
                    <option value="male" className="text-gray-900">Male</option>
                    <option value="female" className="text-gray-900">Female</option>
                    <option value="other" className="text-gray-900">Other</option>
                  </select>
                </div>
              </div>

              {/* Test Selection */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-white">Select Medical Tests to Upload</h3>
                  <div className="bg-blue-500/20 px-4 py-2 rounded-full border border-blue-400/30">
                    <span className="text-blue-200 text-sm font-medium">
                      {selectedReportTypes.length} tests selected
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {Object.entries(medicalTestCategories).map(([category, data]) => (
                    <div key={category} className="bg-white/5 rounded-2xl p-6 border border-white/20">
                      <div className="flex items-center mb-4">
                        <span className="text-3xl mr-3">{data.icon}</span>
                        <h4 className="text-xl font-bold text-white">{category}</h4>
                      </div>
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {data.tests.map((test) => (
                          <label
                            key={test}
                            className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-300 ${
                              selectedReportTypes.includes(test)
                                ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 border-2 border-blue-400/50'
                                : 'bg-white/10 border border-white/20 hover:bg-white/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedReportTypes.includes(test)}
                              onChange={() => toggleReportType(test)}
                              className="sr-only"
                            />
                            <div className={`w-5 h-5 rounded-md border-2 mr-3 flex items-center justify-center transition-all duration-300 ${
                              selectedReportTypes.includes(test)
                                ? 'bg-blue-500 border-blue-400'
                                : 'border-white/40'
                            }`}>
                              {selectedReportTypes.includes(test) && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-sm font-medium transition-colors duration-300 ${
                              selectedReportTypes.includes(test) ? 'text-blue-200' : 'text-gray-300'
                            }`}>
                              {test}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Symptoms */}
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Symptoms & Medical History
                </label>
                <textarea
                  value={reportData.symptoms}
                  onChange={(e) => setReportData({...reportData, symptoms: e.target.value})}
                  rows={4}
                  className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Describe symptoms, medical history, current medications, allergies, or any other relevant information..."
                ></textarea>
              </div>
              
              {/* Urgency Level */}
              <div>
                <label className="block text-white text-sm font-medium mb-4">
                  Priority Level
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: 'low', label: 'Routine Check', color: 'from-green-500 to-green-600', desc: 'Regular health screening' },
                    { value: 'normal', label: 'Standard', color: 'from-yellow-500 to-yellow-600', desc: 'Moderate concern' },
                    { value: 'high', label: 'Urgent', color: 'from-red-500 to-red-600', desc: 'Immediate attention' }
                  ].map((urgency) => (
                    <button
                      key={urgency.value}
                      type="button"
                      onClick={() => setReportData({...reportData, urgency: urgency.value})}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 text-center ${
                        reportData.urgency === urgency.value
                          ? `bg-gradient-to-r ${urgency.color} border-white text-white shadow-lg scale-105`
                          : 'border-white/30 text-gray-300 hover:border-white/50 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-semibold">{urgency.label}</div>
                      <div className="text-xs mt-1 opacity-80">{urgency.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* File Upload Area */}
              <div 
                className="border-2 border-dashed border-white/30 rounded-2xl p-8 text-center hover:border-white/50 transition-all duration-300 bg-gradient-to-r from-blue-500/5 to-purple-500/5 cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => document.getElementById('file-upload').click()}
              >
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h4 className="text-white text-xl font-semibold mb-2">Upload Your Medical Reports</h4>
                <p className="text-gray-300 mb-4">Drop multiple files here or click to browse</p>
                <p className="text-gray-400 text-sm mb-4">Supported formats: PDF, JPG, PNG, DICOM (Max 10MB each)</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-gray-300">Lab Reports</span>
                  <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-gray-300">X-Ray Images</span>
                  <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-gray-300">MRI Scans</span>
                  <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-gray-300">Blood Test Results</span>
                </div>
                <input 
                  id="file-upload"
                  type="file" 
                  multiple 
                  className="hidden" 
                  accept=".pdf,.jpg,.jpeg,.png,.dcm" 
                  onChange={handleFileUpload}
                />
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-white text-lg font-semibold mb-4">Uploaded Files ({uploadedFiles.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="bg-white/10 rounded-xl p-4 flex items-center justify-between border border-white/20">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            {file.type === 'application/pdf' ? (
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm truncate max-w-48">{file.name}</p>
                            <p className="text-gray-400 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-400 hover:text-red-300 transition-colors duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Error Display */}
              {errorState && (
                <div className={`p-6 rounded-2xl border-2 mb-6 ${
                  errorState.type === 'service_unavailable' 
                    ? 'bg-yellow-500/10 border-yellow-500/30' 
                    : errorState.type === 'rate_limited'
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <div className="flex items-start space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      errorState.type === 'service_unavailable' 
                        ? 'bg-yellow-500/20' 
                        : errorState.type === 'rate_limited'
                        ? 'bg-orange-500/20'
                        : 'bg-red-500/20'
                    }`}>
                      {errorState.type === 'service_unavailable' ? (
                        <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : errorState.type === 'rate_limited' ? (
                        <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-semibold mb-2 ${
                        errorState.type === 'service_unavailable' 
                          ? 'text-yellow-300' 
                          : errorState.type === 'rate_limited'
                          ? 'text-orange-300'
                          : 'text-red-300'
                      }`}>
                        {errorState.title}
                      </h4>
                      <p className={`text-sm mb-4 ${
                        errorState.type === 'service_unavailable' 
                          ? 'text-yellow-200' 
                          : errorState.type === 'rate_limited'
                          ? 'text-orange-200'
                          : 'text-red-200'
                      }`}>
                        {errorState.message}
                      </p>
                      {errorState.retryable && (
                        <div className="flex space-x-3">
                          <button
                            type="button"
                            onClick={() => setErrorState(null)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                              errorState.type === 'service_unavailable' 
                                ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' 
                                : errorState.type === 'rate_limited'
                                ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30'
                                : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                            }`}
                          >
                            Dismiss
                          </button>
                          <button
                            type="submit"
                            disabled={analysisLoading}
                            onClick={() => setErrorState(null)}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Try Again
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={analysisLoading}
                className={`w-full py-5 rounded-2xl text-xl font-bold transform transition-all duration-300 flex items-center justify-center space-x-3 ${
                  analysisLoading
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-2xl hover:scale-105'
                }`}
              >
                {analysisLoading ? (
                  <>
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Finding Best Hospitals...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Find Best Hospitals ({uploadedFiles.length} files uploaded)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* AI Analysis Results Section */}
      {analysisResult && (
        <section className="relative z-10 px-6 py-20 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
          <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  Hospital <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">Recommendations</span>
                </h2>
                <p className="text-xl text-gray-300 mb-4">
                  Specialized hospital recommendations based on your medical condition and location
                </p>
              </div>
            
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Medical Report Analysis</h3>
                  <p className="text-gray-300">Based on selected tests and patient information</p>
                </div>
              </div>
              
              <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50">
                <pre className="whitespace-pre-wrap text-gray-200 font-mono text-sm leading-relaxed">
                  {analysisResult}
                </pre>
              </div>
              
              <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h4 className="text-yellow-300 font-semibold mb-1">Medical Disclaimer</h4>
                    <p className="text-yellow-200 text-sm">
                      This AI analysis is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider for medical concerns.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setAnalysisResult(null)}
                  className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300"
                >
                  Clear Results
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-white/20">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">HealthTech AI</span>
          </div>
          <p className="text-gray-300 mb-6">
            Transforming healthcare through artificial intelligence and cutting-edge technology.
          </p>
          <p className="text-gray-400 text-sm">
            © 2024 HealthTech AI. All rights reserved. | Privacy Policy | Terms of Service
          </p>
        </div>
      </footer>
    </div>
  );
}
