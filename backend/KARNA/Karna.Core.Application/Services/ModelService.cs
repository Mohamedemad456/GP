using System;
using System.Collections.Generic;
using System.Text;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.Models;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	public class ModelService(
		IUnitOfWork _unitOfWork,
		ILocalizationService _localizer,
		IValidator<CreateModelDto> _createValidator,
		IValidator<UpdateModelDto> _updateValidator
		) : IModelService
	{
		public async Task<ApiResponse<ModelDto>> CreateAsync(CreateModelDto dto)
		{
			var validationResult = await _createValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<ModelDto> { Success = false, Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage)) };

			var modelRepo = _unitOfWork.GetRepository<Model>();
			var makeRepo = _unitOfWork.GetRepository<Make>();

			var make = await makeRepo.GetAsync(dto.MakeId);
			if (make is null)
				return new ApiResponse<ModelDto> { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			var existing = await modelRepo.GetAsync(m => (m.Name == dto.Name || m.NameAr == dto.NameAr) && m.MakeId == dto.MakeId);
			if (existing is not null)
				return new ApiResponse<ModelDto> { Success = false, Message = _localizer.GetValidationMessage("ModelNameAlreadyExists") };

			var model = dto.ToEntity();

			await modelRepo.AddAsync(model);
			await _unitOfWork.CompleteAsync();

			var createdModel = await modelRepo.GetWithSpecAsync(new ModelWithMakeSpecification(model.Id));
			if (createdModel is null)
			{
				model.Make = make;
				createdModel = model;
			}

			return new ApiResponse<ModelDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ModelCreated"),
				Data = createdModel.ToDto()
			};
		}

		public async Task<ApiResponseDto> DeleteAsync(Guid id)
		{
			var modelRepo = _unitOfWork.GetRepository<Model>();
			var model = await modelRepo.GetAsync(id);

			if (model is null)
				return new ApiResponseDto { Success = false, Message = _localizer.GetErrorMessage("ModelNotFound") };

			modelRepo.Delete(model);
			await _unitOfWork.CompleteAsync();

			return new ApiResponseDto { Success = true, Message = _localizer.GetMessage("ModelDeleted") };
		}

		public async Task<ApiResponse<Pagination<ModelDto>>> GetAllActiveAsync(PaginationSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<Model>();

			var modelSpecParams = new ModelSpecParams
			{
				PageIndex = specParams.PageIndex,
				PageSize = specParams.PageSize,
				Search = specParams.Search,
				Sort = specParams.Sort,
				SortDirection = specParams.SortDirection,
				IsActive = true
			};

			var dataSpec = new ModelListSpecification(modelSpecParams, activeOnly: true, applyPaging: true);
			var countSpec = new ModelListSpecification(modelSpecParams, activeOnly: true, applyPaging: false);

			var models = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<ModelDto>>
			{
				Success = true,
				Data = new Pagination<ModelDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = models.ToDto()
				}
			};
		}

		public async Task<ApiResponse<Pagination<ModelDto>>> GetAllAsync(ModelSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<Model>();

			var dataSpec = new ModelListSpecification(specParams, activeOnly: false, applyPaging: true);
			var countSpec = new ModelListSpecification(specParams, activeOnly: false, applyPaging: false);

			var models = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<ModelDto>>
			{
				Success = true,
				Data = new Pagination<ModelDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = models.ToDto()
				}
			};
		}

		public async Task<ApiResponse<ModelDto>> GetByIdAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Model>();
			var model = await repo.GetWithSpecAsync(new ModelWithMakeSpecification(id));

			if (model is null)
				return new ApiResponse<ModelDto> { Success = false, Message = _localizer.GetErrorMessage("ModelNotFound") };

			return new ApiResponse<ModelDto> { Success = true, Data = model.ToDto() };
		}

		public async Task<ApiResponseDto> ActivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Model>();
			var model = await repo.GetAsync(id);

			if (model is null)
				return new ApiResponseDto { Success = false, Message = _localizer.GetErrorMessage("ModelNotFound") };

			if (!model.IsActive)
			{
				model.IsActive = true;
				repo.Update(model);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto { Success = true, Message = _localizer.GetMessage("ModelActivated") };
		}

		public async Task<ApiResponseDto> DeactivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<Model>();
			var model = await repo.GetAsync(id);

			if (model is null)
				return new ApiResponseDto { Success = false, Message = _localizer.GetErrorMessage("ModelNotFound") };

			if (model.IsActive)
			{
				model.IsActive = false;
				repo.Update(model);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto { Success = true, Message = _localizer.GetMessage("ModelDeactivated") };
		}

		public async Task<ApiResponse<ModelDto>> UpdateAsync(Guid id, UpdateModelDto dto)
		{
			var validationResult = await _updateValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<ModelDto> { Success = false, Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage)) };

			var modelRepo = _unitOfWork.GetRepository<Model>();
			var makeRepo = _unitOfWork.GetRepository<Make>();

			var model = await modelRepo.GetWithSpecAsync(new ModelWithMakeSpecification(id));
			if (model is null)
				return new ApiResponse<ModelDto> { Success = false, Message = _localizer.GetErrorMessage("ModelNotFound") };

			var make = await makeRepo.GetAsync(dto.MakeId);
			if (make is null)
				return new ApiResponse<ModelDto> { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			var duplicate = await modelRepo.GetAsync(m =>
				(m.Name == dto.Name || m.NameAr == dto.NameAr) &&
				m.MakeId == dto.MakeId &&
				m.Id != id);

			if (duplicate is not null)
				return new ApiResponse<ModelDto> { Success = false, Message = _localizer.GetValidationMessage("ModelNameAlreadyExists") };

			dto.ApplyTo(model);
			model.Make = make;

			modelRepo.Update(model);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ModelDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ModelUpdated"),
				Data = model.ToDto()
			};
		}
	}
}
