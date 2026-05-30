import { useEffect, useState } from 'react'

import { fetchMaintenanceStatus } from '../../api/maintenanceApi'

export type RuntimeCapabilities = {
	directCryptoAvailable: boolean
}

const DEFAULT_CAPABILITIES: RuntimeCapabilities = {
	directCryptoAvailable: false,
}

export function useRuntimeCapabilities(): RuntimeCapabilities {
	const [capabilities, setCapabilities] = useState<RuntimeCapabilities>(DEFAULT_CAPABILITIES)

	useEffect(() => {
		let isCancelled = false

		fetchMaintenanceStatus()
			.then((status) => {
				if (!isCancelled) {
					setCapabilities({
						directCryptoAvailable: status.directCryptoAvailable,
					})
				}
			})
			.catch(() => {
				if (!isCancelled) {
					setCapabilities(DEFAULT_CAPABILITIES)
				}
			})

		return () => {
			isCancelled = true
		}
	}, [])

	return capabilities
}