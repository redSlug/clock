// Adds the SVG filters that theme.css uses for the torn-paper edge. Include once, before the page content.
;(function () {
	var svg = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">\n\t<filter id="torn-edge" x="-5%" y="-5%" width="110%" height="110%">\n\t\t<feTurbulence type="fractalNoise" baseFrequency="0.035 0.05" numOctaves="4" seed="7" result="n"/>\n\t\t<feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>\n\t</filter>\n\t<filter id="torn-top" x="-5%" y="-5%" width="110%" height="110%">\n\t\t<feTurbulence type="fractalNoise" baseFrequency="0.03 0.045" numOctaves="5" seed="3" result="n"/>\n\t\t<feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="G" yChannelSelector="R" result="d"/>\n\t\t<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="grain"/>\n\t\t<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.3  0 0 0 0 0.4  0 0 0 0 0.2  0 0 0 0.09 0" result="g"/>\n\t\t<feComposite in="g" in2="d" operator="in" result="gin"/>\n\t\t<feMerge><feMergeNode in="d"/><feMergeNode in="gin"/></feMerge>\n\t</filter>\n</svg>'
	var d = document.createElement("div")
	d.innerHTML = svg
	document.body.insertBefore(d.firstChild, document.body.firstChild)
})()
