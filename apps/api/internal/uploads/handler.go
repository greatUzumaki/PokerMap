package uploads

import (
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/pokermap/api/internal/httpx"
	"github.com/pokermap/api/internal/media"
	"github.com/pokermap/api/internal/validate"
)

type Handler struct {
	Media *media.Service
}

func New(m *media.Service) *Handler { return &Handler{Media: m} }

type signRequest struct {
	ClubID   string `json:"clubId" validate:"omitempty,uuid4"`
	Filename string `json:"filename" validate:"required,min=1,max=256"`
	Mime     string `json:"mime" validate:"required,oneof=image/jpeg image/png image/webp"`
	Size     int64  `json:"size" validate:"required,gte=1,lte=8388608"`
}

func (h *Handler) Sign(w http.ResponseWriter, r *http.Request) {
	var req signRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, r, http.StatusBadRequest, "invalid_body", err.Error())
		return
	}
	if err := validate.V().Struct(req); err != nil {
		httpx.Error(w, r, http.StatusUnprocessableEntity, "validation", "validation failed", validate.Details(err)...)
		return
	}
	clubID := uuid.New()
	if req.ClubID != "" {
		parsed, err := uuid.Parse(req.ClubID)
		if err != nil {
			httpx.Error(w, r, http.StatusBadRequest, "invalid_id", "clubId must be uuid")
			return
		}
		clubID = parsed
	}
	signed, err := h.Media.SignUpload(r.Context(), media.SignUploadParams{
		ClubID:   clubID,
		Filename: req.Filename,
		Mime:     req.Mime,
		Size:     req.Size,
	})
	if err != nil {
		switch {
		case errors.Is(err, media.ErrUnsupportedMime):
			httpx.Error(w, r, http.StatusUnprocessableEntity, "unsupported_media_type", "mime not allowed")
		case errors.Is(err, media.ErrTooLarge):
			httpx.Error(w, r, http.StatusRequestEntityTooLarge, "file_too_large", "file exceeds max size")
		default:
			httpx.Error(w, r, http.StatusInternalServerError, "internal", err.Error())
		}
		return
	}
	httpx.JSON(w, http.StatusOK, signed)
}
