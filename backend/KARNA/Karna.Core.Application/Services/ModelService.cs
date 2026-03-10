using System;
using System.Collections.Generic;
using System.Text;
using AutoMapper;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
    public class ModelService(
        IUnitOfWork _unitOfWork,
        IMapper _mapper,
        ILocalizationService _localizer,
        IValidator<CreateModelDto> _createValidator,
        IValidator<UpdateModelDto> _updateValidator
        ) : IModelService
    {
        public async Task<ApiResponse<ModelDto>> CreateAsync(CreateModelDto dto)
        {
            var validationResult = await _createValidator.ValidateAsync(dto);
            if (!validationResult.IsValid)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
                };

            var modelRepo = _unitOfWork.GetRepository<Model>();
            var makeRepo = _unitOfWork.GetRepository<Make>();

            var make = await makeRepo.GetAsync(dto.MakeId);
            if (make is null)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("MakeNotFound")
                };

            var existing = await modelRepo.GetAsync(m =>
                (m.Name == dto.Name || m.NameAr == dto.NameAr) && m.MakeId == dto.MakeId && !m.IsDeleted);

            if (existing is not null)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ModelNameAlreadyExists")
                };

            var model = _mapper.Map<Model>(dto);

            await modelRepo.AddAsync(model);
            await _unitOfWork.CompleteAsync();

            var spec = new ModelWithMakeSpecification(model.Id);
            var createdModel = await modelRepo.GetWithSpecAsync(spec);

            return new ApiResponse<ModelDto>
            {
                Success = true,
                Message = _localizer.GetMessage("ModelCreated"),
                Data = _mapper.Map<ModelDto>(createdModel)
            };
        }

        public async Task<ApiResponseDto> DeleteAsync(Guid id)
        {
            var modelRepo = _unitOfWork.GetRepository<Model>();
            var spec = new ModelWithMakeSpecification(id);
            var model = await modelRepo.GetWithSpecAsync(spec);

            if (model is null)
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("ModelNotFound")
                };

            modelRepo.Delete(model);
            await _unitOfWork.CompleteAsync();

            return new ApiResponseDto
            {
                Success = true,
                Message = _localizer.GetMessage("ModelDeleted")
            };
        }
        

        public async Task<ApiResponse<IEnumerable<ModelDto>>> GetAllAsync()
        {
            var repo = _unitOfWork.GetRepository<Model>();
            var spec = new ModelWithMakeSpecification();
            var models = await repo.GetAllWithSpecAsync(spec);

            return new ApiResponse<IEnumerable<ModelDto>>
            {
                Success = true,
                Data = _mapper.Map<IEnumerable<ModelDto>>(models)
            };
        }

        public async Task<ApiResponse<ModelDto>> GetByIdAsync(Guid id)
        {
            var repo = _unitOfWork.GetRepository<Model>();
            var spec = new ModelWithMakeSpecification(id);
            var model = await repo.GetWithSpecAsync(spec);

            if (model is null)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("ModelNotFound")
                };

            return new ApiResponse<ModelDto>
            {
                Success = true,
                Data = _mapper.Map<ModelDto>(model)
            };
        }

        public async Task<ApiResponse<ModelDto>> UpdateAsync(Guid id, UpdateModelDto dto)
        {
            var validationResult = await _updateValidator.ValidateAsync(dto);
            if (!validationResult.IsValid)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
                };

            var modelRepo = _unitOfWork.GetRepository<Model>();
            var makeRepo = _unitOfWork.GetRepository<Make>();

            var spec = new ModelWithMakeSpecification(id);
            var model = await modelRepo.GetWithSpecAsync(spec);
            if (model is null)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("ModelNotFound")
                };

            var make = await makeRepo.GetAsync(dto.MakeId);
            if (make is null)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("MakeNotFound")
                };

            var duplicate = await modelRepo.GetAsync(m =>
                (m.Name == dto.Name || m.NameAr == dto.NameAr) &&
                m.MakeId == dto.MakeId &&
                m.Id != id &&
                !m.IsDeleted);

            if (duplicate is not null)
                return new ApiResponse<ModelDto>
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ModelNameAlreadyExists")
                };

            _mapper.Map(dto, model);

            modelRepo.Update(model);
            await _unitOfWork.CompleteAsync();

            return new ApiResponse<ModelDto>
            {
                Success = true,
                Message = _localizer.GetMessage("ModelUpdated"),
                Data = _mapper.Map<ModelDto>(model)
            };
        }
    }
}
