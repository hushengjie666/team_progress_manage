package main

type pushRequest struct {
	DeviceID string    `json:"device_id"`
	Changes  []syncRow `json:"changes"`
}

type pushResponse struct {
	CurrentRevision int64 `json:"current_revision"`
}

type pullResponse struct {
	Changes         []syncRow `json:"changes"`
	CurrentRevision int64     `json:"current_revision"`
}

type revisionResponse struct {
	CurrentRevision int64 `json:"current_revision"`
}
